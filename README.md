# Advanced DICOM Viewer

A modern, high-performance DICOM viewer built with React, Cornerstone.js, VTK.js, and FastAPI. This application provides smooth 2D and 3D visualization of medical imaging data with professional-grade features.

## Features

### 🖼️ 2D Visualization (Cornerstone.js)
- **WebGL-accelerated rendering** for smooth performance
- **Window/Level adjustment** with real-time updates
- **Zoom and pan** with mouse/touch support
- **Frame navigation** with keyboard shortcuts
- **Auto-play** functionality for cine sequences
- **Multi-frame support** with smooth scrolling

### 🎯 3D Visualization (VTK.js)
- **Volume rendering** for 3D data visualization
- **Multi-planar reconstruction** (Axial, Coronal, Sagittal)
- **Interactive 3D manipulation** with mouse controls
- **Real-time rendering** with WebGL acceleration
- **Customizable transfer functions**

### 📊 DICOM Processing
- **Full DICOM parsing** with dicomParser/dcmjs
- **Metadata extraction** and display
- **Series grouping** and organization
- **Patient information** management
- **Study and series descriptions**

### 🎨 Modern UI/UX
- **Dark theme** with professional styling
- **Responsive design** for all screen sizes
- **Smooth animations** with Framer Motion
- **Drag & drop** file upload
- **Real-time status** updates
- **Keyboard shortcuts** for power users

## Technology Stack

### Frontend
- **React 18** - Modern UI framework
- **TypeScript** - Type-safe development
- **Cornerstone.js** - 2D medical imaging
- **VTK.js** - 3D visualization
- **dicomParser** - DICOM file parsing
- **dcmjs** - Advanced DICOM processing
- **Styled Components** - CSS-in-JS styling
- **Framer Motion** - Smooth animations
- **React Dropzone** - File upload handling

### Backend
- **FastAPI** - High-performance Python API
- **Pydicom** - DICOM file processing
- **NumPy** - Numerical computations
- **Pillow** - Image processing
- **Uvicorn** - ASGI server

## Installation

### Prerequisites
- Python 3.8+
- Node.js 16+
- npm or yarn

### Backend Setup

1. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

2. **Start the backend server:**
```bash
python start_backend.py
```

The backend will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to the frontend directory:**
```bash
cd fe
```

2. **Install dependencies:**
```bash
npm install
```

3. **Start the development server:**
```bash
npm start
# or use the provided script
./start_frontend.sh
```

The frontend will be available at `http://localhost:3000`

## Usage

### 1. Upload DICOM Data
- Drag and drop ZIP files containing DICOM data onto the upload area
- Or click to browse and select files
- The system will automatically process and validate the files

### 2. Select Series
- Browse available DICOM series in the sidebar
- Click on a series to load it into the viewer
- View patient information, modality, and frame count

### 3. 2D Viewing
- Use mouse wheel to zoom in/out
- Click and drag to pan around the image
- Adjust Window Width (WW) and Window Level (WL) for optimal contrast
- Navigate frames using the slider or play button
- Use keyboard shortcuts for quick navigation

### 4. 3D Viewing
- Switch to 3D view using the toggle button
- Choose between Volume, Axial, Coronal, or Sagittal views
- Interact with 3D models using mouse controls
- Reset camera view as needed

### 5. Controls
- **Frame Navigation**: Use slider or play/pause controls
- **Window/Level**: Adjust image contrast and brightness
- **Zoom**: Scale the image for detailed viewing
- **Reset View**: Return to default view settings
- **Metadata**: View detailed DICOM information

## API Endpoints

### Upload and Processing
- `POST /api/upload` - Upload ZIP files containing DICOM data
- `GET /api/sessions` - List active sessions
- `DELETE /api/sessions/{session_id}` - Delete a session

### Series and Frame Access
- `GET /api/series/{session_id}/{series_uid}` - Get series data
- `GET /api/series/{session_id}/{series_uid}/frame/{frame_index}` - Get individual frame

## Keyboard Shortcuts

- **Space** - Play/Pause frame animation
- **Arrow Keys** - Navigate frames
- **R** - Reset view
- **+/-** - Zoom in/out
- **M** - Toggle metadata panel
- **1/2** - Switch between 2D/3D views

## Performance Optimization

### Backend Optimizations
- **Caching** with Streamlit's cache_data decorator
- **Efficient frame extraction** with NumPy operations
- **Memory management** for large datasets
- **Progressive loading** for large series

### Frontend Optimizations
- **WebGL rendering** for hardware acceleration
- **Frame preloading** for smooth navigation
- **Virtual scrolling** for large series
- **Image compression** for faster loading
- **Lazy loading** of components

## Browser Compatibility

- **Chrome** 90+ (Recommended)
- **Firefox** 88+
- **Safari** 14+
- **Edge** 90+

WebGL support is required for optimal performance.

## Development

### Project Structure
```
zip_viewer/
├── app.py                 # Original Streamlit app
├── backend.py             # FastAPI backend
├── start_backend.py       # Backend startup script
├── requirements.txt       # Python dependencies
├── fe/                    # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── context/       # React contexts
│   │   └── App.tsx        # Main app component
│   ├── package.json       # Node dependencies
│   └── start_frontend.sh  # Frontend startup script
└── README.md
```

### Adding New Features

1. **Backend**: Add new endpoints in `backend.py`
2. **Frontend**: Create components in `fe/src/components/`
3. **Context**: Update contexts for state management
4. **Styling**: Use styled-components for consistent theming

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure backend is running on port 8000
2. **WebGL Issues**: Update graphics drivers or try different browser
3. **Memory Issues**: Reduce frame count or image resolution
4. **Upload Failures**: Check file format and size limits

### Performance Tips

1. **Large Series**: Use frame sampling for better performance
2. **Memory Usage**: Close unused series to free memory
3. **Network**: Use local files for faster loading
4. **Browser**: Close other tabs to free up resources

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- **Cornerstone.js** team for the excellent 2D medical imaging library
- **VTK.js** team for the powerful 3D visualization toolkit
- **Pydicom** contributors for Python DICOM processing
- **FastAPI** team for the high-performance web framework
