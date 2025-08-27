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
from functools import lru_cache

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


@st.cache_data(show_spinner=False)
def build_series_from_zip_blobs(zips: List[Tuple[str, bytes]]):
	# zips: list of (filename, bytes)
	items: List[Tuple[str, bytes]] = []
	for name, file_bytes in zips:
		items.extend(load_zip(file_bytes, name_prefix=f"{name}/"))
	return group_dicoms_by_series(items)


@st.cache_data(show_spinner=False, max_entries=1000)
def pre_render_frame_optimized(frame: np.ndarray, ww: float, wl: float, zoom: int) -> Image.Image:
	"""Optimized frame rendering with faster processing"""
	# Use faster normalization for real-time updates
	arr = frame.astype(np.float32)
	
	# Optimize window/level calculation for ww=1, wl=1 case
	if ww == 1 and wl == 1:
		# Fast path for default settings - use full range
		arr = (arr - arr.min()) / (arr.max() - arr.min() + 1e-8)
	else:
		# Custom window/level
		low = wl - ww / 2.0
		high = wl + ww / 2.0
		arr = np.clip(arr, low, high)
		if high - low > 0:
			arr = (arr - low) / (high - low)
		else:
			arr = arr - low
	
	arr = (arr * 255.0).astype(np.uint8)
	img = Image.fromarray(arr)
	
	# Apply zoom if needed
	if zoom != 100:
		scale = zoom / 100.0
		new_size = (int(img.width * scale), int(img.height * scale))
		img = img.resize(new_size, Image.Resampling.LANCZOS)
	
	# Limit image size for consistent display across all column layouts
	max_size = 200
	if img.width > max_size or img.height > max_size:
		img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
	
	return img


@st.cache_data(show_spinner=False, max_entries=200)
def get_frame_thumbnail(frame: np.ndarray, max_size: int = 200) -> Image.Image:
	"""Create fast thumbnail for smooth dragging - no window/level processing"""
	# Fast normalization without window/level for thumbnails
	arr = frame.astype(np.float32)
	arr = (arr - arr.min()) / (arr.max() - arr.min() + 1e-8)
	arr = (arr * 255.0).astype(np.uint8)
	img = Image.fromarray(arr)
	img.thumbnail((max_size, max_size), Image.Resampling.NEAREST)
	return img


@st.cache_data(show_spinner=False, max_entries=50)
def preload_adjacent_frames(frames: List[np.ndarray], current_idx: int, ww: float, wl: float, zoom: int, cache_range: int = 3) -> List[Image.Image]:
	"""Pre-load adjacent frames for smoother scrolling (like IMAIOS viewer)"""
	start_idx = max(0, current_idx - cache_range)
	end_idx = min(len(frames), current_idx + cache_range + 1)
	
	preloaded = []
	for i in range(start_idx, end_idx):
		img = pre_render_frame_optimized(frames[i], ww, wl, zoom)
		preloaded.append(img)
	
	return preloaded


@st.cache_data(show_spinner=False, max_entries=100)
def sample_frames_for_large_series(frames: List[np.ndarray], max_frames: int = 20) -> List[np.ndarray]:
	"""Sample frames from large series to create a manageable subset"""
	if len(frames) <= max_frames:
		return frames
	
	# Calculate sampling interval
	interval = len(frames) // max_frames
	
	# Sample frames evenly across the series
	sampled = []
	for i in range(0, len(frames), interval):
		sampled.append(frames[i])
		if len(sampled) >= max_frames:
			break
	
	# Always include the last frame
	if sampled[-1] is not frames[-1]:
		sampled[-1] = frames[-1]
	
	return sampled


@st.cache_data(show_spinner=False, max_entries=200)
def create_compact_thumbnail(frame: np.ndarray, max_size: int = 150) -> Image.Image:
	"""Create very small thumbnail for compact large series display"""
	# Fast normalization
	arr = frame.astype(np.float32)
	arr = (arr - arr.min()) / (arr.max() - arr.min() + 1e-8)
	arr = (arr * 255.0).astype(np.uint8)
	img = Image.fromarray(arr)
	img.thumbnail((max_size, max_size), Image.Resampling.NEAREST)
	return img


@st.cache_data(show_spinner=False)
def create_thumbnail(frame: np.ndarray, ww: float, wl: float, max_size: int = 200) -> Image.Image:
	"""Create fast thumbnail for smooth dragging"""
	img = Image.fromarray(normalize_to_uint8(frame, ww=ww, wl=wl))
	img.thumbnail((max_size, max_size), Image.Resampling.NEAREST)
	return img


@st.fragment
def render_compact_series_panel(uid: str, gs: Dict[str, object], panel_index: int, num_frames: int):
	"""Compact viewer for large series (>65 frames)"""
	panel_key = f"compact_frame_{uid}"
	if panel_key not in st.session_state:
		st.session_state[panel_key] = 1

	# Series info header with compact indicator
	st.markdown(f"**{gs['modality']}** — {gs['series_desc']} 📊")
	st.caption(f"{gs['patient_name']} | {num_frames} frames (Compact Mode)")

	# Sample frames for display (max 20 frames)
	frames: List[np.ndarray] = gs["frames"]  # type: ignore
	sampled_frames = sample_frames_for_large_series(frames, max_frames=20)
	
	# Frame slider for sampled frames
	current_frame = st.slider(
		f"Frame {gs['modality']} (Sampled)",
		min_value=1,
		max_value=len(sampled_frames),
		key=panel_key,
		help=f"Navigate through {len(sampled_frames)} sampled frames from {num_frames} total frames"
	)

	# Render compact thumbnail
	frame_idx = current_frame - 1
	img = create_compact_thumbnail(sampled_frames[frame_idx], max_size=150)
	
	# Calculate actual frame number from sampling
	actual_frame_num = (frame_idx * len(frames)) // len(sampled_frames) + 1
	
	st.image(img, caption=f"Frame {actual_frame_num}/{num_frames} (Sampled) | Series {panel_index+1}", width=400)


def create_table_grid(series: Dict[str, Dict[str, object]], grid_selection: List[str], num_cols: int, performance_mode: bool):
	"""Create a responsive table-based grid layout with adaptive image sizing"""
	# Calculate number of rows needed
	num_series = len(grid_selection)
	num_rows = (num_series + num_cols - 1) // num_cols
	
	# Create table rows with proper spacing
	for row in range(num_rows):
		# For single column layout, center the content
		if num_cols == 1:
			cols = st.columns([1, 2, 1], gap="medium")  # Left spacer, content, right spacer
			content_col = 1  # Use middle column for content
		else:
			cols = st.columns(num_cols, gap="medium")  # Add gap between columns
			content_col = 0  # Start from first column
		
		for col in range(num_cols):
			series_idx = row * num_cols + col
			if series_idx < num_series:
				uid = grid_selection[series_idx]
				gs = series[uid]
				g_frames: List[np.ndarray] = gs["frames"]  # type: ignore
				if g_frames:
					# Use appropriate column based on layout
					if num_cols == 1:
						display_col = content_col  # Always use middle column for single column
					else:
						display_col = content_col + col  # Use sequential columns for multi-column
					with cols[display_col]:
						# Add container with spacing
						with st.container():
							render_compact_series_panel(uid, gs, series_idx, len(g_frames), performance_mode, num_cols)


@st.fragment
def render_compact_series_panel(uid: str, gs: Dict[str, object], panel_index: int, num_frames: int, performance_mode: bool = True, num_cols: int = 4):
	panel_key = f"grid_frame_{uid}"
	if panel_key not in st.session_state:
		st.session_state[panel_key] = 1

	# Ultra-compact series info
	st.markdown(f"**{gs['modality']}** {gs['series_desc'][:20]}{'...' if len(gs['series_desc']) > 20 else ''}")
	st.caption(f"{gs['patient_name'][:15]}{'...' if len(gs['patient_name']) > 15 else ''} ({num_frames})")

	# Compact WW/WL controls in single row
	col_ww, col_wl, col_frame = st.columns([1, 1, 1])
	with col_ww:
		panel_ww = st.number_input(
			"WW", 
			value=1.0, 
			min_value=0.1, 
			max_value=1000.0, 
			step=0.1,
			key=f"ww_{uid}", 
			label_visibility="collapsed",
			help="Window Width"
		)
	with col_wl:
		panel_wl = st.number_input(
			"WL", 
			value=1.0, 
			min_value=-1000.0, 
			max_value=1000.0, 
			step=0.1,
			key=f"wl_{uid}", 
			label_visibility="collapsed",
			help="Window Level"
		)
	with col_frame:
		current_frame = st.slider(
			"Frame",
			min_value=1,
			max_value=num_frames,
			key=panel_key,
			label_visibility="collapsed"
		)

	# Render only the current frame for smoother scrolling
	frames: List[np.ndarray] = gs["frames"]  # type: ignore
	frame_idx = current_frame - 1
	
	# Use optimized single-frame rendering for instant display
	if performance_mode:
		# Fast mode: use responsive thumbnail size for better quality
		max_size = 350 if num_cols <= 2 else 250 if num_cols == 3 else 250
		img = create_thumbnail(frames[frame_idx], panel_ww, panel_wl, max_size=max_size)
	else:
		# Quality mode: use full rendering with preloading (like IMAIOS)
		img = pre_render_frame_optimized(frames[frame_idx], panel_ww, panel_wl, 100)  # Fixed zoom at 100%
		# Pre-load adjacent frames for smoother scrolling
		preload_adjacent_frames(frames, frame_idx, panel_ww, panel_wl, 100, cache_range=2)
	
	# Use responsive image width with larger size for wide mode
	image_width = 350 if num_cols <= 2 else 250 if num_cols == 3 else 250
	st.image(img, caption=f"{current_frame}/{num_frames}", width=image_width)


def main():
	st.set_page_config(
		page_title="DICOM Grid Viewer", 
		layout="wide",
		initial_sidebar_state="collapsed"
	)
	
	# Add custom CSS for responsive layout
	st.markdown("""
	<style>
	.main .block-container {
		padding-top: 0.5rem;
		padding-bottom: 1rem;
		padding-left: 1rem;
		padding-right: 1rem;
	}
	.stImage > img {
		border-radius: 0.5rem;
	}
	.element-container {
		margin-bottom: 0.5rem;
	}
	/* Prevent grid overlap with better spacing */
	.stImage {
		margin-bottom: 1rem !important;
	}
	/* Add spacing between grid items */
	[data-testid="column"] {
		padding: 0.5rem !important;
	}
	/* Responsive file uploader */
	.stFileUploader {
		width: 100% !important;
		max-width: 600px !important;
	}
	.stFileUploader > div {
		height: 80px !important;
	}
	.stFileUploader > div > div {
		height: 60px !important;
	}
	/* Responsive grid adjustments */
	@media (max-width: 768px) {
		.stFileUploader {
			width: 100% !important;
			max-width: 100% !important;
		}
		.stFileUploader > div {
			height: 100px !important;
		}
		.stFileUploader > div > div {
			height: 80px !important;
		}
		/* Adjust padding for narrow screens */
		.main .block-container {
			padding-left: 0.5rem !important;
			padding-right: 0.5rem !important;
		}
	}
	/* Ensure images don't overflow on narrow screens */
	.stImage > img {
		max-width: 100% !important;
		height: auto !important;
	}
	/* Additional spacing for compact mode */
	.stContainer {
		margin-bottom: 1rem !important;
		padding: 0.5rem !important;
	}
	/* Ensure proper spacing between grid elements */
	div[data-testid="stVerticalBlock"] > div[data-testid="stVerticalBlock"] {
		margin-bottom: 1rem !important;
	}
	/* Compact WW/WL controls styling */
	.stNumberInput > div > div > input {
		font-size: 0.8rem !important;
		padding: 0.25rem !important;
		height: 2rem !important;
	}
	.stNumberInput label {
		font-size: 0.8rem !important;
		font-weight: bold !important;
	}
	</style>
	""", unsafe_allow_html=True)
	
	# Compact header
	st.title("DICOM Grid Viewer")
	
	# File upload section in column direction with reduced size
	uploaded_files = st.file_uploader(
		"Choose ZIP file(s) to analyze", 
		type=["zip"], 
		accept_multiple_files=True,
		help="Select one or more ZIP files containing DICOM data"
	)
	
	if not uploaded_files:
		st.info("**No files selected yet.** Please upload one or more ZIP files to begin DICOM analysis.")
		return

	# Loading spinner + cached processing
	with st.spinner("Processing ZIP files and extracting DICOM data..."):
		zip_blobs: List[Tuple[str, bytes]] = [(uf.name, uf.read()) for uf in uploaded_files]
		all_series = build_series_from_zip_blobs(zip_blobs)
	
	# Filter to exclude series with exactly 68 frames
	series = {uid: s for uid, s in all_series.items() if len(s.get("frames", [])) != 68}
	filtered_count = len(all_series) - len(series)
	
	if series:
		# st.success(f"**{len(series)} DICOM series** detected")
		
		uid_list = list(series.keys())
		patients_map = {uid: f"{series[uid]['patient_name']} ({series[uid]['patient_id']})" for uid in uid_list}
		
		# Series selection with responsive layout
		col_series, col_columns = st.columns([3, 1])
		with col_series:
			grid_selection = st.multiselect(
				"Select series",
				options=uid_list,
				format_func=lambda u: f"{patients_map[u]} — {series[u]['modality']} {series[u]['series_desc']}",
				help="Choose which DICOM series to display"
			)
		with col_columns:
			num_cols = st.number_input("Columns", min_value=1, max_value=4, value=2, key="grid_cols")
		
		if grid_selection:
			performance_mode = True
			# Create table-based grid
			create_table_grid(series, grid_selection, num_cols, performance_mode)
	else:
		st.warning("**No DICOM series found** in the uploaded files. Please ensure your ZIP files contain valid DICOM data.")

	# st.success("**Analysis complete!** Your DICOM grid is ready for review.")


if __name__ == "__main__":
	main()
