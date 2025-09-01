import io
import os
import zipfile
import base64
from typing import Dict, List, Tuple, Optional
from pathlib import Path
import tempfile
import shutil

import numpy as np
import pydicom
from pydicom.valuerep import PersonName
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

# Import functions from the original app.py
from app import (
    format_patient_name, load_zip, is_image, is_pdf, try_load_dicom,
    normalize_to_uint8, extract_frames_from_dataset, _parse_time_to_float,
    group_dicoms_by_series, build_series_from_zip_blobs
)

app = FastAPI(title="DICOM Viewer API", version="1.0.0")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000",'*'],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global storage for processed data
processed_data = {}

@app.get("/")
async def root():
    return {"message": "DICOM Viewer API is running"}

@app.post("/api/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """Upload and process ZIP files containing DICOM data"""
    try:
        zip_blobs: List[Tuple[str, bytes]] = []
        invalid_files = []
        
        for uf in files:
            try:
                # Validate file extension
                if not uf.filename.lower().endswith('.zip'):
                    invalid_files.append(f"{uf.filename} (not a ZIP file)")
                    continue
                
                # Read file bytes
                file_bytes = await uf.read()
                
                # Check if file is empty
                if len(file_bytes) == 0:
                    invalid_files.append(f"{uf.filename} (empty file)")
                    continue
                
                # Test if it's a valid ZIP file
                try:
                    with zipfile.ZipFile(io.BytesIO(file_bytes)) as test_zf:
                        test_zf.infolist()
                    zip_blobs.append((uf.filename, file_bytes))
                except zipfile.BadZipFile:
                    invalid_files.append(f"{uf.filename} (invalid ZIP file)")
                    continue
                except Exception as zip_error:
                    invalid_files.append(f"{uf.filename} (ZIP error: {str(zip_error)})")
                    continue
                    
            except Exception as e:
                invalid_files.append(f"{uf.filename} (unexpected error: {str(e)})")
                continue
        
        if not zip_blobs:
            raise HTTPException(status_code=400, detail="No valid ZIP files found")
        
        # Process the DICOM data
        all_series = build_series_from_zip_blobs(zip_blobs)
        
        # Filter to exclude series with exactly 68 frames (as in original app)
        series = {uid: s for uid, s in all_series.items() if len(s.get("frames", [])) != 68}
        
        # Store processed data
        session_id = f"session_{len(processed_data)}"
        processed_data[session_id] = {
            "series": series,
            "zip_blobs": zip_blobs
        }
        
        # Prepare response data
        series_list = []
        for uid, s in series.items():
            series_info = {
                "uid": uid,
                "series_desc": s["series_desc"],
                "modality": s["modality"],
                "patient_name": s["patient_name"],
                "patient_id": s["patient_id"],
                "study_desc": s["study_desc"],
                "frame_count": len(s["frames"]),
                "examples": s["examples"][:5]  # Limit examples
            }
            series_list.append(series_info)
        
        return {
            "session_id": session_id,
            "series": series_list,
            "invalid_files": invalid_files,
            "total_series": len(series_list)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing files: {str(e)}")

@app.get("/api/series/{session_id}/{series_uid}")
async def get_series_data(session_id: str, series_uid: str):
    """Get DICOM series data including frames and metadata"""
    if session_id not in processed_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    series_data = processed_data[session_id]["series"]
    if series_uid not in series_data:
        raise HTTPException(status_code=404, detail="Series not found")
    
    series = series_data[series_uid]
    frames = series["frames"]
    
    # Convert frames to base64 for transmission
    frame_data = []
    for i, frame in enumerate(frames):
        # Convert numpy array to PIL Image
        img = Image.fromarray(frame.astype(np.uint8))
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()
        
        frame_data.append({
            "index": i,
            "data": img_str,
            "width": frame.shape[1],
            "height": frame.shape[0]
        })
    
    return {
        "series_uid": series_uid,
        "series_desc": series["series_desc"],
        "modality": series["modality"],
        "patient_name": series["patient_name"],
        "patient_id": series["patient_id"],
        "study_desc": series["study_desc"],
        "frame_count": len(frames),
        "frames": frame_data
    }

@app.get("/api/series/{session_id}/{series_uid}/frame/{frame_index}")
async def get_frame(session_id: str, series_uid: str, frame_index: int):
    """Get individual frame data"""
    if session_id not in processed_data:
        raise HTTPException(status_code=404, detail="Session not found")
    
    series_data = processed_data[session_id]["series"]
    if series_uid not in series_data:
        raise HTTPException(status_code=404, detail="Series not found")
    
    series = series_data[series_uid]
    frames = series["frames"]
    
    if frame_index < 0 or frame_index >= len(frames):
        raise HTTPException(status_code=404, detail="Frame index out of range")
    
    frame = frames[frame_index]
    
    # Convert to base64
    img = Image.fromarray(frame.astype(np.uint8))
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        "frame_index": frame_index,
        "data": img_str,
        "width": frame.shape[1],
        "height": frame.shape[0],
        "total_frames": len(frames)
    }

@app.get("/api/sessions")
async def get_sessions():
    """Get list of active sessions"""
    return {
        "sessions": list(processed_data.keys()),
        "count": len(processed_data)
    }

@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its data"""
    if session_id in processed_data:
        del processed_data[session_id]
        return {"message": "Session deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail="Session not found")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8116)
