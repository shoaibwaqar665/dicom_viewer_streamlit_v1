import io
import os
import zipfile
from typing import Dict, List, Tuple

import numpy as np
import pydicom
from PIL import Image
import streamlit as st
from pdf2image import convert_from_bytes
import time

# -------------------------------
# Helpers
# -------------------------------


def load_zip(file_bytes: bytes) -> List[Tuple[str, bytes]]:
	with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
		items = []
		for info in zf.infolist():
			if info.is_dir():
				continue
			with zf.open(info) as f:
				items.append((info.filename, f.read()))
		return items


def is_image(name: str) -> bool:
	lower = name.lower()
	return lower.endswith((".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tiff", ".tif"))


def is_pdf(name: str) -> bool:
	return name.lower().endswith(".pdf")


def try_load_dicom(name: str, data: bytes):
	# Attempt to parse as DICOM even if no extension; return dataset and pixel image if present
	try:
		ds = pydicom.dcmread(io.BytesIO(data), force=True)
		pixel_img = None
		if hasattr(ds, "pixel_array"):
			arr = ds.pixel_array
			# Handle monochrome/inverted photometric interpretation
			if hasattr(ds, "PhotometricInterpretation") and ds.PhotometricInterpretation == "MONOCHROME1":
				arr = np.max(arr) - arr
			# Normalize to 0-255
			arr = arr.astype(np.float32)
			arr -= arr.min()
			if arr.max() > 0:
				arr /= arr.max()
			arr = (arr * 255).astype(np.uint8)
			if arr.ndim == 2:
				pixel_img = Image.fromarray(arr)
			elif arr.ndim == 3 and arr.shape[-1] in (3, 4):
				pixel_img = Image.fromarray(arr)
		return ds, pixel_img
	except Exception:
		return None, None


def normalize_to_uint8(arr: np.ndarray, ww: float = None, wl: float = None) -> np.ndarray:
	# arr is expected as numpy array of any integer or float type
	arr = arr.astype(np.float32)
	min_v = float(np.min(arr))
	max_v = float(np.max(arr))
	if ww is None or wl is None:
		# Auto window from data if not provided
		low, high = min_v, max_v
	else:
		low = wl - ww / 2.0
		high = wl + ww / 2.0
	arr = np.clip(arr, low, high)
	if high - low > 0:
		arr = (arr - low) / (high - low)
	else:
		arr = arr - low
	arr = (arr * 255.0).astype(np.uint8)
	return arr


def extract_frames_from_dataset(ds: pydicom.dataset.FileDataset) -> List[np.ndarray]:
	# Returns a list of 2D frames (np.uint8) for viewing
	if not hasattr(ds, "pixel_array"):
		return []
	arr = ds.pixel_array
	# Invert MONOCHROME1
	if hasattr(ds, "PhotometricInterpretation") and ds.PhotometricInterpretation == "MONOCHROME1":
		arr = np.max(arr) - arr
	# Flatten higher dims to a list of 2D frames
	if arr.ndim == 2:
		frames = [arr]
	elif arr.ndim == 3:
		# Heuristic: assume first dim is frames/time or slices
		frames = [arr[i, ...] for i in range(arr.shape[0])]
	else:
		# Collapse all leading dims except the last 2
		lead = int(np.prod(arr.shape[:-2]))
		frames = [arr.reshape(lead, arr.shape[-2], arr.shape[-1])[i] for i in range(lead)]
	# Convert to uint8 range using per-frame normalization for robustness
	return [normalize_to_uint8(f) for f in frames]


def _parse_time_to_float(hhmmss: str) -> float:
	try:
		if not isinstance(hhmmss, str):
			return 0.0
		# Format could be HHMMSS.FFFFFF
		hh = float(hhmmss[0:2] or 0)
		mm = float(hhmmss[2:4] or 0)
		ss = float(hhmmss[4:] or 0)
		return hh * 3600.0 + mm * 60.0 + ss
	except Exception:
		return 0.0


def group_dicoms_by_series(items: List[Tuple[str, bytes]]):
	# Returns dict[series_uid] -> {
	#   'series_desc': str, 'modality': str, 'frames': [np.ndarray], 'examples': [str],
	#   'patient_name': str, 'patient_id': str, 'study_desc': str
	# }
	series: Dict[str, Dict[str, object]] = {}
	for name, data in items:
		try:
			ds = pydicom.dcmread(io.BytesIO(data), force=True, stop_before_pixels=False)
		except Exception:
			continue
		series_uid = getattr(ds, "SeriesInstanceUID", None)
		if not series_uid:
			continue
		frames: List[np.ndarray] = []
		try:
			frames = extract_frames_from_dataset(ds)
		except Exception:
			frames = []
		entry = series.setdefault(series_uid, {
			"series_desc": str(getattr(ds, "SeriesDescription", "")),
			"modality": str(getattr(ds, "Modality", "")),
			"frames": [],
			"examples": [],
			"patient_name": str(getattr(ds, "PatientName", "")),
			"patient_id": str(getattr(ds, "PatientID", "")),
			"study_desc": str(getattr(ds, "StudyDescription", "")),
		})
		# Build an ordering key using common tags
		instance = getattr(ds, "InstanceNumber", None)
		image_index = getattr(ds, "ImageIndex", None)
		acq_num = getattr(ds, "AcquisitionNumber", None)
		acq_time = _parse_time_to_float(getattr(ds, "AcquisitionTime", ""))
		base_key = (
			float(instance) if instance is not None else 1e12,
			float(image_index) if image_index is not None else 1e12,
			float(acq_num) if acq_num is not None else 1e12,
			acq_time,
		)
		keyed_frames = []
		for idx, f in enumerate(frames):
			keyed_frames.append((base_key + (idx,), f))
		entry.setdefault("_keyed", [])  # type: ignore
		entry["_keyed"].extend(keyed_frames)  # type: ignore
		entry["examples"].append(name)
	# Finalize ordering
	for uid, s in series.items():
		keyed = s.get("_keyed", [])  # type: ignore
		if keyed:
			keyed.sort(key=lambda kv: kv[0])  # type: ignore
			s["frames"] = [f for _, f in keyed]  # type: ignore
			try:
				del s["_keyed"]
			except Exception:
				pass
	return series


def main():
	st.set_page_config(page_title="ZIP Viewer", layout="wide")
	st.title("ZIP Viewer for Imaging Files")
	st.caption("Upload a .zip; we will preview images, PDFs (first page), and DICOMs.")

	uploaded = st.file_uploader("Upload ZIP", type=["zip"], accept_multiple_files=False)
	if not uploaded:
		st.info("Select a .zip file to begin.")
		return

	with st.spinner("Loading ZIP..."):
		items = load_zip(uploaded.read())

	# Sidebar: file list
	st.sidebar.header("Files in ZIP")
	for name, _ in items:
		st.sidebar.write(name)

	# Sidebar: display sizing
	st.sidebar.subheader("Display")
	preview_width = st.sidebar.slider("Preview width (px)", min_value=128, max_value=800, value=400, step=16)
	mosaic_width = st.sidebar.slider("Mosaic tile width (px)", min_value=128, max_value=600, value=300, step=16)

	# DICOM series preview (patient + multi-frame with controls)
	series = group_dicoms_by_series(items)
	if series:
		st.subheader("DICOM Series Preview")
		uid_list = list(series.keys())
		patients_map = {uid: f"{series[uid]['patient_name']} ({series[uid]['patient_id']})" for uid in uid_list}
		sel_uid = st.selectbox("Select series", options=uid_list, format_func=lambda u: f"{patients_map[u]} — {series[u]['modality']} {series[u]['series_desc']}")
		s = series[sel_uid]
		st.markdown(f"**Now viewing patient:** {s['patient_name']} ({s['patient_id']}) — {s['study_desc']}")
		frames: List[np.ndarray] = s["frames"]  # type: ignore
		if frames:
			# Frame state keys
			frame_key = f"frame_{sel_uid}"
			pending_key = f"frame_pending_{sel_uid}"
			default_frame = 1
			# Initialize and apply any pending navigation BEFORE slider is created
			if frame_key not in st.session_state:
				st.session_state[frame_key] = default_frame
			if pending_key in st.session_state:
				st.session_state[frame_key] = int(st.session_state[pending_key])
				del st.session_state[pending_key]

			series_label = f"{s['modality']} - {s['series_desc']} (frames: {len(frames)})"  # type: ignore
			st.markdown(f"**{series_label}**")
			# Controls
			col_ctrl1, col_ctrl2, col_ctrl3, col_ctrl4, col_ctrl5 = st.columns([2, 1, 1, 1, 1])
			with col_ctrl1:
				st.slider("Frame", min_value=1, max_value=len(frames), key=frame_key)
			with col_ctrl2:
				ww = st.number_input("WW", value=float(255), key=f"ww_{sel_uid}")
			with col_ctrl3:
				wl = st.number_input("WL", value=float(128), key=f"wl_{sel_uid}")
			with col_ctrl4:
				zoom = st.slider("Zoom %", min_value=50, max_value=300, value=100, step=10, key=f"zoom_{sel_uid}")
			with col_ctrl5:
				fps = st.slider("FPS", min_value=1, max_value=30, value=8, key=f"fps_{sel_uid}")

			# Read current frame index from state
			idx = int(st.session_state.get(frame_key, default_frame))

			# Play/Pause & step (update PENDING state; slider will consume next run)
			col_btn1, col_btn2, col_btn3 = st.columns([1, 1, 2])
			if col_btn1.button("Prev", key=f"prev_{sel_uid}"):
				new_idx = idx - 1 if idx > 1 else len(frames)
				st.session_state[pending_key] = new_idx
				st.rerun()
			play_state_key = f"play_{sel_uid}"
			playing = st.session_state.get(play_state_key, False)
			if col_btn2.toggle("Play", value=playing, key=play_state_key):
				playing = True
			else:
				playing = False
			if col_btn3.button("Next", key=f"next_{sel_uid}"):
				new_idx = idx + 1 if idx < len(frames) else 1
				st.session_state[pending_key] = new_idx
				st.rerun()

			# Show selected frame
			scale = (zoom / 100.0)
			frame_img = Image.fromarray(normalize_to_uint8(frames[idx - 1], ww=ww, wl=wl))
			st.image(frame_img, caption=f"Frame {idx}/{len(frames)} — Patient: {s['patient_name']}", width=int(preview_width * scale))

			# 2x2 mosaic around current frame
			mosaic_cols = st.columns(2)
			offsets = [-len(frames)//6, 0, len(frames)//6, len(frames)//3]
			positions = [min(max((idx - 1) + off, 0), len(frames) - 1) for off in offsets]
			mosaic_imgs = [Image.fromarray(normalize_to_uint8(frames[p], ww=ww, wl=wl)) for p in positions]
			with mosaic_cols[0]:
				st.image(mosaic_imgs[0], caption=f"IM: {positions[0]+1}/{len(frames)}", width=mosaic_width)
				st.image(mosaic_imgs[1], caption=f"IM: {positions[1]+1}/{len(frames)}", width=mosaic_width)
			with mosaic_cols[1]:
				st.image(mosaic_imgs[2], caption=f"IM: {positions[2]+1}/{len(frames)}", width=mosaic_width)
				st.image(mosaic_imgs[3], caption=f"IM: {positions[3]+1}/{len(frames)}", width=mosaic_width)

			# Cine playback loop (schedule next frame via pending key)
			if playing:
				time.sleep(1.0 / float(max(1, fps)))
				new_idx = idx + 1 if idx < len(frames) else 1
				st.session_state[pending_key] = new_idx
				st.rerun()

	# Group previews for non-DICOM files
	img_cols = st.columns(3)
	img_idx = 0

	for name, data in items:
		placeholder = st.container()
		with placeholder:
			st.markdown(f"**{name}**")
			# Direct image
			if is_image(name):
				try:
					img = Image.open(io.BytesIO(data))
					st.image(img, width=preview_width)
				except Exception as e:
					st.warning(f"Image failed to load: {e}")
				continue

			# PDF preview
			if is_pdf(name):
				try:
					pages = convert_from_bytes(data, first_page=1, last_page=1)
					if pages:
						st.image(pages[0], caption="First page", width=preview_width)
					else:
						st.info("PDF has no renderable pages.")
				except Exception as e:
					st.warning(f"PDF preview failed: {e}")
				continue

			# Try DICOM
			ds, pix = try_load_dicom(name, data)
			if ds is not None:
				# Basic header table
				patient = getattr(ds, "PatientName", "?")
				study_desc = getattr(ds, "StudyDescription", "")
				series_desc = getattr(ds, "SeriesDescription", "")
				st.write({
					"PatientName": str(patient),
					"Modality": getattr(ds, "Modality", ""),
					"StudyDescription": str(study_desc),
					"SeriesDescription": str(series_desc),
					"Rows": getattr(ds, "Rows", ""),
					"Columns": getattr(ds, "Columns", ""),
				})
				if pix is not None:
					st.image(pix, width=preview_width)
				else:
					st.info("No pixel data to display.")
				continue

			# Fallback: offer download
			st.download_button("Download file", data=data, file_name=os.path.basename(name))

	st.success("Done.")


if __name__ == "__main__":
	main()
