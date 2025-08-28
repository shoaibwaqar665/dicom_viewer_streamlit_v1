import React, { forwardRef, useEffect, useRef, useImperativeHandle, useState, useCallback } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useCornerstone } from '../context/CornerstoneContext';
import { DICOMFrame } from '../context/DICOMContext';

const ViewerContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  background-color: #000000;
  overflow: hidden;
`;

const CornerstoneElement = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Canvas = styled.canvas`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background-color: #000000;
`;

const Overlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 10;
`;

const FrameInfo = styled(motion.div)`
  position: absolute;
  top: 1rem;
  left: 1rem;
  background-color: rgba(0, 0, 0, 0.7);
  color: #fafafa;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 600;
`;

const LoadingIndicator = styled(motion.div)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`;

const LoadingSpinner = styled(motion.div)`
  width: 40px;
  height: 40px;
  border: 3px solid #3d4043;
  border-top: 3px solid #00d4aa;
  border-radius: 50%;
`;

const LoadingText = styled.div`
  color: #fafafa;
  font-weight: 600;
`;

const ErrorMessage = styled(motion.div)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(248, 113, 113, 0.1);
  border: 1px solid #f87171;
  color: #f87171;
  padding: 1rem 2rem;
  border-radius: 8px;
  text-align: center;
  max-width: 400px;
`;

interface Viewer2DProps {
  frames: DICOMFrame[];
  currentFrameIndex: number;
  windowWidth: number;
  windowLevel: number;
}

export interface Viewer2DRef {
  resetView: () => void;
  setWindowLevel: (ww: number, wl: number) => void;
}

const Viewer2D = forwardRef<Viewer2DRef, Viewer2DProps>(({
  frames,
  currentFrameIndex,
  windowWidth,
  windowLevel
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cornerstoneElementRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state: cornerstoneState, setupViewport, setWindowLevel, resetView } = useCornerstone();
  
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [imageIds, setImageIds] = React.useState<string[]>([]);
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);

  // Apply window/level to image data
  const applyWindowLevel = useCallback((imageData: ImageData, windowWidth: number, windowLevel: number) => {
    const data = imageData.data;
    const windowMin = windowLevel - windowWidth / 2;
    const windowMax = windowLevel + windowWidth / 2;
    
    for (let i = 0; i < data.length; i += 4) {
      // Get the grayscale value (assuming grayscale image)
      const gray = data[i]; // Red channel for grayscale
      
      // Apply window/level transformation
      let newValue;
      if (gray <= windowMin) {
        newValue = 0;
      } else if (gray >= windowMax) {
        newValue = 255;
      } else {
        // Linear mapping within window
        newValue = Math.round(((gray - windowMin) / (windowMax - windowMin)) * 255);
      }
      
      // Apply to all RGB channels for grayscale
      data[i] = newValue;     // Red
      data[i + 1] = newValue; // Green
      data[i + 2] = newValue; // Blue
      // Alpha channel remains unchanged
    }
    
    return imageData;
  }, []);

  // Load and display image on canvas with window/level adjustment
  const loadAndDisplayImage = useCallback(async (imageDataUrl: string, ww?: number, wl?: number) => {
    if (!canvasRef.current) return;

    console.log(`Viewer2D: loadAndDisplayImage called with WW=${ww}, WL=${wl}`);

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size to match container
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate image position to center it
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      const x = (canvas.width - scaledWidth) / 2;
      const y = (canvas.height - scaledHeight) / 2;

      // Draw image first
      ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
      
      // Apply window/level if provided
      if (ww && wl) {
        console.log(`Viewer2D: Applying window/level WW=${ww}, WL=${wl} to image`);
        // Get image data from the drawn area
        const imageData = ctx.getImageData(x, y, scaledWidth, scaledHeight);
        const adjustedImageData = applyWindowLevel(imageData, ww, wl);
        ctx.putImageData(adjustedImageData, x, y);
      } else {
        console.log(`Viewer2D: No window/level applied (ww=${ww}, wl=${wl})`);
      }
      
      setCurrentImage(img);
    };
    img.onerror = () => {
      setError('Failed to load image');
    };
    img.src = imageDataUrl;
  }, [applyWindowLevel]);

  useImperativeHandle(ref, () => ({
    resetView: () => {
      resetView();
    },
    setWindowLevel: (ww: number, wl: number) => {
      setWindowLevel(ww, wl);
    }
  }));

  // Convert frames to Cornerstone image IDs
  useEffect(() => {
    if (frames.length === 0) return;

    const newImageIds = frames.map((frame, index) => {
      // Create a data URL from the base64 frame data
      return `data:image/png;base64,${frame.data}`;
    });

    setImageIds(newImageIds);
  }, [frames]);

  // Setup viewport when image IDs are ready
  useEffect(() => {
    if (imageIds.length === 0 || !cornerstoneElementRef.current || isLoading) return;

    const setupViewer = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await setupViewport(cornerstoneElementRef.current!, imageIds);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to setup viewport');
      } finally {
        setIsLoading(false);
      }
    };

    setupViewer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageIds, isLoading]); // setupViewport is stable due to useCallback

  // Update window/level when props change
  useEffect(() => {
    if (currentFrameIndex >= 0 && currentFrameIndex < frames.length && imageIds.length > 0 && windowWidth && windowLevel) {
      console.log(`Viewer2D: Applying WW=${windowWidth}, WL=${windowLevel} to frame ${currentFrameIndex}`);
      const imageDataUrl = imageIds[currentFrameIndex];
      if (imageDataUrl) {
        loadAndDisplayImage(imageDataUrl, windowWidth, windowLevel);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowWidth, windowLevel, currentFrameIndex, frames.length, imageIds]); // loadAndDisplayImage is stable



  // Handle frame changes
  useEffect(() => {
    if (currentFrameIndex >= 0 && currentFrameIndex < frames.length && imageIds.length > 0) {
      try {
        console.log(`Viewer2D: Changing to frame ${currentFrameIndex} with WW=${windowWidth}, WL=${windowLevel}`);
        const imageDataUrl = imageIds[currentFrameIndex];
        if (imageDataUrl) {
          loadAndDisplayImage(imageDataUrl, windowWidth, windowLevel);
        }
      } catch (err) {
        console.error('Failed to change frame:', err);
        setError('Failed to load frame');
      }
    }
  }, [currentFrameIndex, frames.length, imageIds, loadAndDisplayImage, windowWidth, windowLevel]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (currentImage && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          canvas.width = rect.width;
          canvas.height = rect.height;
        }

        // Redraw the current image
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const scale = Math.min(canvas.width / currentImage.width, canvas.height / currentImage.height);
        const scaledWidth = currentImage.width * scale;
        const scaledHeight = currentImage.height * scale;
        const x = (canvas.width - scaledWidth) / 2;
        const y = (canvas.height - scaledHeight) / 2;

        // Draw image first
        ctx.drawImage(currentImage, x, y, scaledWidth, scaledHeight);
        
        // Apply current window/level
        if (windowWidth && windowLevel) {
          const imageData = ctx.getImageData(x, y, scaledWidth, scaledHeight);
          const adjustedImageData = applyWindowLevel(imageData, windowWidth, windowLevel);
          ctx.putImageData(adjustedImageData, x, y);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentImage, windowWidth, windowLevel, applyWindowLevel]);

  const currentFrame = frames[currentFrameIndex];

  return (
    <ViewerContainer ref={containerRef}>
      <CornerstoneElement ref={cornerstoneElementRef}>
        <Canvas ref={canvasRef} />
      </CornerstoneElement>
      
      <Overlay>
        {currentFrame && (
          <FrameInfo
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            Frame {currentFrameIndex + 1} / {frames.length}
            <br />
            {currentFrame.width} × {currentFrame.height}
          </FrameInfo>
        )}
      </Overlay>

      {isLoading && (
        <LoadingIndicator
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <LoadingSpinner
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <LoadingText>Loading DICOM viewer...</LoadingText>
        </LoadingIndicator>
      )}

      {error && (
        <ErrorMessage
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
        >
          {error}
        </ErrorMessage>
      )}

      {frames.length === 0 && !isLoading && !error && (
        <LoadingIndicator>
          <LoadingText>No DICOM frames available</LoadingText>
        </LoadingIndicator>
      )}
    </ViewerContainer>
  );
});

Viewer2D.displayName = 'Viewer2D';

export default Viewer2D;
