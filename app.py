import io
import os
import zipfile
from typing import Dict, List, Tuple

import numpy as np
import pydicom
from pydicom.valuerep import PersonName
from PIL import Image
import streamlit as st

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
	try:
		with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
			items = []
			for info in zf.infolist():
				if info.is_dir():
					continue
				with zf.open(info) as f:
					items.append((f"{name_prefix}{info.filename}", f.read()))
			return items
	except zipfile.BadZipFile:
		# Return empty list for invalid ZIP files
		return []
	except Exception as e:
		# Handle other potential errors
		return []


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
	# Returns a list of 2D frames (np.uint8) for viewing - optimized for speed
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
	# Fast conversion to uint8 - skip normalization for speed
	return [f.astype(np.uint8) for f in frames]


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


@st.cache_data(show_spinner=False, max_entries=100)
def preload_adjacent_frames(frames: List[np.ndarray], current_idx: int, ww: float, wl: float, zoom: int, cache_range: int = 3) -> List[Image.Image]:
	"""Pre-load adjacent frames for smoother scrolling (like IMAIOS viewer)"""
	start_idx = max(0, current_idx - cache_range)
	end_idx = min(len(frames), current_idx + cache_range + 1)
	
	preloaded = []
	for i in range(start_idx, end_idx):
		if i != current_idx:  # Don't re-render current frame
			img = pre_render_frame_optimized(frames[i], ww, wl, zoom)
			preloaded.append(img)
	
	return preloaded


@st.cache_data(show_spinner=False, max_entries=200)
def preload_instant_thumbnails(frames: List[np.ndarray], current_idx: int, max_size: int = 250, cache_range: int = 5) -> List[Image.Image]:
	"""Pre-load instant thumbnails for ultra-smooth scrolling"""
	start_idx = max(0, current_idx - cache_range)
	end_idx = min(len(frames), current_idx + cache_range + 1)
	
	preloaded = []
	for i in range(start_idx, end_idx):
		if i != current_idx:  # Don't re-render current frame
			img = create_instant_thumbnail(frames[i], max_size)
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


@st.cache_data(show_spinner=False, max_entries=50)
def progressive_frame_loading(frames: List[np.ndarray], current_idx: int, load_range: int = 10) -> List[np.ndarray]:
	"""Progressive loading for large series - load frames in chunks around current position"""
	if len(frames) <= load_range:
		return frames
	
	start_idx = max(0, current_idx - load_range // 2)
	end_idx = min(len(frames), start_idx + load_range)
	
	# Return a subset of frames around the current position
	return frames[start_idx:end_idx]


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


@st.cache_data(show_spinner=False, max_entries=1000)
def create_instant_thumbnail(frame: np.ndarray, max_size: int = 250) -> Image.Image:
	"""Ultra-fast thumbnail for instant slider response"""
	# Skip normalization for maximum speed - use raw data
	arr = frame.astype(np.uint8)
	
	# Create image directly
	img = Image.fromarray(arr)
	
	# Fast resize only if needed
	if img.width > max_size or img.height > max_size:
		img.thumbnail((max_size, max_size), Image.Resampling.NEAREST)
	
	return img


@st.cache_data(show_spinner=False, max_entries=300)
def create_thumbnail(frame: np.ndarray, ww: float, wl: float, max_size: int = 200) -> Image.Image:
	"""Create fast thumbnail for smooth dragging"""
	# Optimize for common case where ww=1, wl=1 (default settings)
	if ww == 1.0 and wl == 1.0:
		# Fast path for default settings
		arr = frame.astype(np.float32)
		min_val, max_val = np.min(arr), np.max(arr)
		if max_val > min_val:
			arr = (arr - min_val) / (max_val - min_val)
		else:
			arr = arr - min_val
		arr = (arr * 255.0).astype(np.uint8)
	else:
		# Use window/level normalization
		arr = normalize_to_uint8(frame, ww=ww, wl=wl)
	
	img = Image.fromarray(arr)
	# Only resize if necessary
	if img.width > max_size or img.height > max_size:
		img.thumbnail((max_size, max_size), Image.Resampling.NEAREST)
	return img


@st.fragment
def render_compact_series_panel(uid: str, gs: Dict[str, object], panel_index: int, num_frames: int):
	"""Compact viewer for large series (>65 frames)"""
	panel_key = f"compact_frame_{uid}"
	if panel_key not in st.session_state:
		st.session_state[panel_key] = 1

	# Series info header
	st.markdown(f"**{gs['modality']}** — {gs['series_desc']}")
	st.caption(f"{gs['patient_name']} | {num_frames} frames")

	# Sample frames for display (max 20 frames)
	frames: List[np.ndarray] = gs["frames"]  # type: ignore
	sampled_frames = sample_frames_for_large_series(frames, max_frames=20)
	
	# Frame slider for sampled frames
	current_frame = st.slider(
		f"Frame {gs['modality']}",
		min_value=1,
		max_value=len(sampled_frames),
		key=panel_key,
		help=f"Navigate through {len(sampled_frames)} sampled frames from {num_frames} total frames"
	)

	# Real-time slider with instant feedback
	frame_idx = current_frame - 1
	
	# Show instant thumbnail first
	instant_img = create_instant_thumbnail(sampled_frames[frame_idx], max_size=150)
	image_placeholder = st.empty()
	
	# Calculate actual frame number from sampling
	actual_frame_num = (frame_idx * len(frames)) // len(sampled_frames) + 1
	
	image_placeholder.image(instant_img, caption=f"Frame {actual_frame_num}/{num_frames} | Series {panel_index+1}", width=400)
	
	# Then load the full-quality compact thumbnail
	img = create_compact_thumbnail(sampled_frames[frame_idx], max_size=150)
	image_placeholder.image(img, caption=f"Frame {actual_frame_num}/{num_frames} | Series {panel_index+1}", width=400)


def create_table_grid(series: Dict[str, Dict[str, object]], grid_selection: List[str], num_cols: int, performance_mode: bool):
	"""Create a professional grid layout with clean spacing"""
	num_series = len(grid_selection)
	num_rows = (num_series + num_cols - 1) // num_cols
	
	# Create professional grid rows
	for row in range(num_rows):
		if num_cols == 1:
			# Center content for single column
			cols = st.columns([1, 2, 1], gap="large")
			content_col = 1
		elif num_cols == 2:
			# Center content for 2 columns
			cols = st.columns([1, 1, 1], gap="large")
			content_col = 0
		else:
			# Left align for 3+ columns
			cols = st.columns(num_cols, gap="large")
			content_col = 0
		
		for col in range(num_cols):
			series_idx = row * num_cols + col
			if series_idx < num_series:
				uid = grid_selection[series_idx]
				gs = series[uid]
				g_frames: List[np.ndarray] = gs["frames"]  # type: ignore
				if g_frames:
					if num_cols == 1:
						display_col = content_col
					elif num_cols == 2:
						display_col = content_col + col
					else:
						display_col = content_col + col
					with cols[display_col]:
						with st.container():
							render_compact_series_panel(uid, gs, series_idx, len(g_frames), performance_mode, num_cols)


@st.fragment
def render_compact_series_panel(uid: str, gs: Dict[str, object], panel_index: int, num_frames: int, performance_mode: bool = True, num_cols: int = 4):
	panel_key = f"grid_frame_{uid}"
	if panel_key not in st.session_state:
		st.session_state[panel_key] = 1

	# Professional series info
	st.markdown(f"**{gs['modality']}** {gs['series_desc'][:25]}{'...' if len(gs['series_desc']) > 25 else ''}")
	st.caption(f"{gs['patient_name'][:20]}{'...' if len(gs['patient_name']) > 20 else ''} ({num_frames} frames)")

	# Compact controls layout - WW/WL in first row
	col_ww, col_wl = st.columns([1, 1])
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
	
	# Ultra-fast frame slider with reduced updates
	current_frame = st.slider(
		"Frame",
		min_value=1,
		max_value=num_frames,
		step=1,
		key=panel_key,
		label_visibility="collapsed",
		help="Drag to navigate frames"
	)

	# Render only the current frame for smoother scrolling
	frames: List[np.ndarray] = gs["frames"]  # type: ignore
	frame_idx = current_frame - 1
	
	# Ultra-fast image sizing - smaller for speed
	if num_cols == 1:
		image_width = 350
		max_size = 350
	elif num_cols == 2:
		image_width = 350
		max_size = 350
	elif num_cols == 3:
		image_width = 350
		max_size = 350
	else:  # 4 columns
		image_width = 350
		max_size = 350
	
	# Ultra-fast rendering - minimal processing
	# Use direct numpy array to PIL conversion for maximum speed
	frame_data = frames[frame_idx]
	
	# Fast resize if needed
	if frame_data.shape[0] > max_size or frame_data.shape[1] > max_size:
		# Use numpy for faster resizing
		scale = min(max_size / frame_data.shape[0], max_size / frame_data.shape[1])
		new_h, new_w = int(frame_data.shape[0] * scale), int(frame_data.shape[1] * scale)
		frame_data = np.array(Image.fromarray(frame_data).resize((new_w, new_h), Image.Resampling.NEAREST))
	
	# Convert to PIL and display
	img = Image.fromarray(frame_data.astype(np.uint8))
	st.image(img, caption=f"{current_frame}/{num_frames}", width=image_width)


def main():
	st.set_page_config(
		page_title="DICOM Viewer", 
		layout="wide",
		initial_sidebar_state="collapsed"
	)
	
	# Professional dark theme CSS
	st.markdown("""
	<style>
	/* Dark theme base */
	.stApp {
		background-color: #0e1117;
		color: #fafafa;
	}
	
	/* Main container */
	.main .block-container {
		max-width: 100% !important;
		padding: 1rem 2rem;
		background-color: #0e1117;
		border-radius: 6px;
	}
	
	/* Hide Streamlit branding */
	#MainMenu {visibility: hidden;}
	footer {visibility: hidden;}
	header {visibility: hidden;}
	
	/* Professional typography */
	h1, h2, h3, h4, h5, h6 {
		color: #ffffff !important;
		font-weight: 600;
	}
	
	/* Dark theme for widgets */
	.stSelectbox > div > div {
		background-color: #262730;
		border: 1px solid #3d4043;
		color: #fafafa;
	}
	
	.stNumberInput > div > div > input {
		background-color: #262730;
		border: 1px solid #3d4043;
		color: #fafafa;
		font-size: 0.85rem;
		padding: 0.3rem;
		height: 1.8rem;
		width: 100%;
	}
	
	.stSlider > div > div > div > div {
		background-color: #262730;
	}
	
	.stSlider > div > div > div > div > div {
		
		transition: none !important;
	}
	
	/* Ultra-fast slider styling */
	.stSlider input[type="range"] {
		transition: none !important;
	}
	
	
	/* File uploader styling */
	.stFileUploader {
		background-color: #262730;
		border: 2px dashed #3d4043;
		border-radius: 8px;
		padding: 1rem;
	}
	
	.stFileUploader > div {
		background-color: transparent;
		border: none;
	}
	
	/* Image containers */
	.stImage > img {
		border-radius: 6px;
		border: 1px solid #3d4043;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}
	
	/* Professional grid layout */
	[data-testid="column"] {
		padding: 1rem;
		background-color: #1a1b23;
		border-radius: 8px;
		margin: 0.75rem;
		border: 1px solid #2d2e36;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}
	
	/* Compact controls */
	.element-container {
		margin-bottom: 0.5rem;
	}
	
	/* Professional spacing */
	.stContainer {
		margin-bottom: 0.75rem;
		padding: 0.5rem;
		background-color: #1a1b23;
		border-radius: 6px;
		border: 1px solid #2d2e36;
	}
	
	/* Status messages */
	.stSuccess {
		background-color: #1e3a2e;
		border: 1px solid #2d5a3d;
		color: #4ade80;
	}
	
	.stWarning {
		background-color: #3a2e1e;
		border: 1px solid #5a3d2d;
		color: #fbbf24;
	}
	
	.stError {
		background-color: #3a1e1e;
		border: 1px solid #5a2d2d;
		color: #f87171;
	}
	
	.stInfo {
		background-color: #1e2a3a;
		border: 1px solid #2d3d5a;
		color: #60a5fa;
	}
	
	/* Responsive design for all desktop screens */
	@media (max-width: 1200px) {
		.main .block-container {
			padding: 1rem 1.5rem;
		}
		[data-testid="column"] {
			padding: 0.75rem;
			margin: 0.5rem;
		}
		.stImage > img {
			max-width: 280px !important;
		}
	}
	
	@media (max-width: 992px) {
		.main .block-container {
			padding: 0.75rem 1rem;
		}
		[data-testid="column"] {
			padding: 0.5rem;
			margin: 0.4rem;
		}
		.stImage > img {
			max-width: 250px !important;
		}
	}
	
	@media (max-width: 768px) {
		.main .block-container {
			padding: 0.5rem 0.75rem;
		}
		[data-testid="column"] {
			padding: 0.4rem;
			margin: 0.3rem;
		}
		.stImage > img {
			max-width: 220px !important;
		}
	}
	
	@media (max-width: 576px) {
		.main .block-container {
			padding: 0.5rem 0.5rem;
		}
		[data-testid="column"] {
			padding: 0.3rem;
			margin: 0.2rem;
		}
		.stImage > img {
			max-width: 200px !important;
		}
	}
	
	/* Large desktop screens */
	@media (min-width: 1400px) {
		.main .block-container {
			padding: 1.5rem 3rem;
		}
		[data-testid="column"] {
			padding: 1.25rem;
			margin: 1rem;
		}
		.stImage > img {
			max-width: 350px !important;
		}
	}
	
	/* Ultra-wide screens */
	@media (min-width: 1920px) {
		.main .block-container {
			padding: 2rem 4rem;
		}
		[data-testid="column"] {
			padding: 1.5rem;
			margin: 1.25rem;
		}
		.stImage > img {
			max-width: 400px !important;
		}
	}
	
	/* Professional button styling */
	.stButton > button {
		# background-color: #00d4aa;
		color: #0e1117;
		border: none;
		border-radius: 6px;
		font-weight: 600;
		transition: all 0.2s ease;
	}
	
	.stButton > button:hover {
		background-color: #00b894;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 212, 170, 0.3);
	}
	
	/* Caption styling */
	.stImage > div {
		color: #9ca3af;
		font-size: 0.85rem;
		text-align: center;
		margin-top: 0.5rem;
	}
	
	/* Multiselect styling */
	.stMultiSelect > div > div {
		background-color: #262730;
		border: 1px solid #3d4043;
		border-radius: 8px;
	}
	
	.stMultiSelect > div > div > div {
		background-color: #262730;
		color: #fafafa;
		border-radius: 6px;
	}
	
	.stMultiSelect > div > div > div > div {
		border-radius: 6px;
	}
	
	/* Professional typography improvements */
	.stMarkdown h1, .stMarkdown h2, .stMarkdown h3 {
		margin-top: 0.5rem;
		margin-bottom: 0.75rem;
	}
	
	/* Compact spacing for better density */
	.stMarkdown p {
		margin-bottom: 0.25rem;
	}
	
	/* Professional caption styling */
	.stImage > div {
		font-size: 0.8rem;
		font-weight: 500;
		color: #9ca3af;
		text-align: center;
		margin-top: 0.5rem;
		padding: 0.25rem;
		background-color: rgba(26, 27, 35, 0.8);
		border-radius: 4px;
	}
	
	/* Responsive controls */
	@media (max-width: 992px) {
		.stNumberInput > div > div > input {
			font-size: 0.8rem;
			padding: 0.25rem;
			height: 1.6rem;
		}
		.stSlider > div > div > div {
			height: 0.3rem;
		}
	}
	
	@media (max-width: 768px) {
		.stNumberInput > div > div > input {
			font-size: 0.75rem;
			padding: 0.2rem;
			height: 1.4rem;
		}
		.stSlider > div > div > div {
			height: 0.25rem;
		}
	}
	
	/* Responsive file uploader */
	@media (max-width: 1200px) {
		.stFileUploader {
			max-width: 500px;
		}
	}
	
	@media (max-width: 768px) {
		.stFileUploader {
			max-width: 100%;
		}
	}
	</style>
	""", unsafe_allow_html=True)
	
	# Professional header
	st.markdown("## DICOM Viewer")
	
	# Initialize session state for uploaded files
	if 'uploaded_files' not in st.session_state:
		st.session_state.uploaded_files = None
	
	# File upload section - only show if no files uploaded
	if st.session_state.uploaded_files is None:
		uploaded_files = st.file_uploader(
			"Upload DICOM ZIP files", 
			type=["zip"], 
			accept_multiple_files=True,
			help="Select ZIP files containing DICOM data"
		)
		
		if uploaded_files:
			st.session_state.uploaded_files = uploaded_files
			st.rerun()
		else:
			st.info("Upload ZIP files to begin analysis")
			return
	else:
		uploaded_files = st.session_state.uploaded_files

	# Processing
	with st.spinner("Processing DICOM data..."):
		zip_blobs: List[Tuple[str, bytes]] = []
		invalid_files = []
		
		for uf in uploaded_files:
			try:
				# Validate file extension
				if not uf.name.lower().endswith('.zip'):
					invalid_files.append(f"{uf.name} (not a ZIP file)")
					continue
				
				# Check if file object is valid
				if uf is None:
					invalid_files.append(f"{uf.name} (file object is None)")
					continue
				
				# Read file bytes with better error handling
				try:
					# Reset file pointer to beginning
					uf.seek(0)
					file_bytes = uf.read()
					
					# Check if file is empty
					if len(file_bytes) == 0:
						invalid_files.append(f"{uf.name} (empty file)")
						continue
						
				except Exception as read_error:
					invalid_files.append(f"{uf.name} (error reading file: {str(read_error)})")
					continue
				
				# Test if it's a valid ZIP file
				try:
					with zipfile.ZipFile(io.BytesIO(file_bytes)) as test_zf:
						test_zf.infolist()  # Try to read the file list
					zip_blobs.append((uf.name, file_bytes))
				except zipfile.BadZipFile:
					invalid_files.append(f"{uf.name} (invalid ZIP file)")
					continue
				except Exception as zip_error:
					invalid_files.append(f"{uf.name} (ZIP error: {str(zip_error)})")
					continue
					
			except Exception as e:
				invalid_files.append(f"{uf.name} (unexpected error: {str(e)})")
				continue
		
		# Show warnings for invalid files
		if invalid_files:
			st.warning(f"Invalid files skipped: {', '.join(invalid_files)}")
		
		# Check if we have any valid files
		if not zip_blobs:
			st.error("No valid ZIP files found. Please upload valid ZIP files containing DICOM data.")
			return
		
		try:
			all_series = build_series_from_zip_blobs(zip_blobs)
		except Exception as e:
			st.error(f"Error processing ZIP files: {str(e)}")
			return
	
	# Filter to exclude series with exactly 68 frames
	series = {uid: s for uid, s in all_series.items() if len(s.get("frames", [])) != 68}
	filtered_count = len(all_series) - len(series)
	
	if series:
		uid_list = list(series.keys())
		patients_map = {uid: f"{series[uid]['patient_name']} ({series[uid]['patient_id']})" for uid in uid_list}
		
		# Compact series selection
		col_series, col_columns = st.columns([3, 1])
		with col_series:
			grid_selection = st.multiselect(
				"Select series",
				options=uid_list,
				format_func=lambda u: f"{patients_map[u]} — {series[u]['modality']} {series[u]['series_desc']}",
				help="Choose DICOM series to display"
			)
		with col_columns:
			num_cols = st.selectbox("Layout", options=[1, 2, 3, 4], index=1, key="grid_cols")
		
		if grid_selection:
			performance_mode = True
			create_table_grid(series, grid_selection, num_cols, performance_mode)
	else:
		st.warning("No DICOM series found in uploaded files")


if __name__ == "__main__":
	main()
