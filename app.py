import io
import os
import zipfile
from typing import Dict, List, Tuple

import numpy as np
import pydicom
from pydicom.valuerep import PersonName
from PIL import Image
import streamlit as st
from pdf2image import convert_from_bytes
import time

# -------------------------------
# Helpers
# -------------------------------


def format_patient_name(pn_obj) -> str:
	# Convert DICOM PN (with ^ separators) into a friendly display name
	try:
		pn = PersonName(str(pn_obj).split('=')[0])  # use alphabetic representation if multi-rep
		parts = []
		if getattr(pn, 'given_name', None):
			parts.append(pn.given_name)
		if getattr(pn, 'middle_name', None):
			parts.append(pn.middle_name)
		if getattr(pn, 'family_name', None):
			parts.append(pn.family_name)
		if getattr(pn, 'name_suffix', None):
			parts.append(pn.name_suffix)
		name = " ".join(p for p in parts if p)
		return name or str(pn_obj).replace('^', ' ').strip()
	except Exception:
		return str(pn_obj).replace('^', ' ').strip()


def load_zip(file_bytes: bytes, name_prefix: str = "") -> List[Tuple[str, bytes]]:
	with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
		items = []
		for info in zf.infolist():
			if info.is_dir():
				continue
			with zf.open(info) as f:
				items.append((f"{name_prefix}{info.filename}", f.read()))
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
			"patient_name": format_patient_name(getattr(ds, "PatientName", "")),
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
	st.set_page_config(
		page_title="DICOM Grid Viewer", 
		layout="wide",
		initial_sidebar_state="collapsed"
	)
	
	# Enhanced header
	st.title("DICOM Grid Viewer")
	st.caption("Advanced multi-series DICOM visualization with synchronized controls")
	
	# File upload section
	uploaded_files = st.file_uploader(
		"Choose ZIP file(s) to analyze", 
		type=["zip"], 
		accept_multiple_files=True,
		help="Select one or more ZIP files containing DICOM data"
	)
	if not uploaded_files:
		st.info("**No files selected yet.** Please upload one or more ZIP files to begin DICOM analysis.")
		return

	# Loading spinner
	with st.spinner("Processing ZIP files and extracting DICOM data..."):
		items: List[Tuple[str, bytes]] = []
		for uf in uploaded_files:
			zip_items = load_zip(uf.read(), name_prefix=f"{uf.name}/")
			items.extend(zip_items)

	# DICOM processing and grid view
	series = group_dicoms_by_series(items)
	if series:
		st.subheader("DICOM Series Analysis")
		st.success(f"**{len(series)} DICOM series** detected and processed successfully!")
		
		# Grid view section
		st.subheader("Multi-Series Grid View")
		
		uid_list = list(series.keys())
		patients_map = {uid: f"{series[uid]['patient_name']} ({series[uid]['patient_id']})" for uid in uid_list}
		
		# Series selection
		col1, col2 = st.columns([3, 1])
		with col1:
			grid_selection = st.multiselect(
				"Select series for grid display",
				options=uid_list,
				format_func=lambda u: f"{patients_map[u]} — {series[u]['modality']} {series[u]['series_desc']}",
				help="Choose which DICOM series to display in the grid"
			)
		with col2:
			if grid_selection:
				st.metric("Selected Series", len(grid_selection))
		
		if grid_selection:
			# Control panel
			st.markdown("**Grid Controls**")
			
			# Control columns
			col_gc1, col_gc2, col_gc3, col_gc4 = st.columns([2, 1, 1, 1])
			with col_gc1:
				g_ww = st.number_input(
					"Window Width (WW)", 
					value=float(255), 
					key="grid_ww",
					help="Adjust image contrast"
				)
			with col_gc2:
				g_wl = st.number_input(
					"Window Level (WL)", 
					value=float(128), 
					key="grid_wl",
					help="Adjust image brightness"
				)
			with col_gc3:
				g_zoom = st.slider(
					"Zoom (%)", 
					min_value=50, 
					max_value=300, 
					value=100, 
					step=10, 
					key="grid_zoom",
					help="Zoom level for all grid images"
				)
			with col_gc4:
				num_cols = st.slider(
					"Columns", 
					min_value=1, 
					max_value=4, 
					value=2, 
					key="grid_cols",
					help="Number of columns in the grid layout"
				)

			# Grid display
			st.markdown("**Series Grid Display**")
			
			# Create grid columns
			grid_cols = st.columns(num_cols)
			
			# Render each selected series
			for i, uid in enumerate(grid_selection):
				gs = series[uid]
				g_frames: List[np.ndarray] = gs["frames"]  # type: ignore
				
				if not g_frames:
					continue
				
				panel_key = f"grid_frame_{uid}"
				if panel_key not in st.session_state:
					st.session_state[panel_key] = 1
				
				with grid_cols[i % num_cols]:
					# Series info header
					st.markdown(f"**{gs['modality']}** — {gs['series_desc']}")
					st.caption(f"{gs['patient_name']} | {len(g_frames)} frames")
					
					# Frame slider
					st.slider(
						f"Frame {gs['modality']}", 
						min_value=1, 
						max_value=len(g_frames), 
						key=panel_key,
						help=f"Navigate through {len(g_frames)} frames"
					)
					
					# Image display
					local_idx = int(st.session_state.get(panel_key, 1)) - 1
					img = Image.fromarray(normalize_to_uint8(g_frames[local_idx], ww=g_ww, wl=g_wl))
					scale = (g_zoom / 100.0)
					
					# Caption
					caption = f"Frame {local_idx+1}/{len(g_frames)} | Series {i+1}"
					
					st.image(
						img, 
						caption=caption, 
						width=400,
						use_container_width=True
					)
			
			# Grid summary
			st.success(f"Grid displaying **{len(grid_selection)} series** with synchronized controls")
	else:
		st.warning("**No DICOM series found** in the uploaded files. Please ensure your ZIP files contain valid DICOM data.")

	st.success("**Analysis complete!** Your DICOM grid is ready for review.")


if __name__ == "__main__":
	main()
