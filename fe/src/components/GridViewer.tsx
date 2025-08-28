import React, { forwardRef, useEffect, useRef, useImperativeHandle, useState, useCallback } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { DICOMFrame } from '../context/DICOMContext';

const GridContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  background-color: #000000;
  overflow: hidden;
  display: grid;
  gap: 2px;
  padding: 2px;
`;

const GridCell = styled.div<{ gridSize: number }>`
  position: relative;
  background-color: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
`;

const Canvas = styled.canvas`
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background-color: #000000;
  display: block;
`;

const FrameInfo = styled(motion.div)`
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  background-color: rgba(0, 0, 0, 0.7);
  color: #fafafa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  z-index: 10;
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
  width: 30px;
  height: 30px;
  border: 2px solid #3d4043;
  border-top: 2px solid #00d4aa;
  border-radius: 50%;
`;

const LoadingText = styled.div`
  color: #fafafa;
  font-weight: 600;
  font-size: 0.875rem;
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

interface GridViewerProps {
  frames: DICOMFrame[];
  currentFrameIndex: number;
  windowWidth: number;
  windowLevel: number;
  gridSize: number;
}

export interface GridViewerRef {
  resetView: () => void;
  setWindowLevel: (ww: number, wl: number) => void;
}

const GridViewer = forwardRef<GridViewerRef, GridViewerProps>(({
  frames,
  currentFrameIndex,
  windowWidth,
  windowLevel,
  gridSize
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageIds, setImageIds] = useState<string[]>([]);

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
  const loadAndDisplayImage = useCallback(async (imageDataUrl: string, canvas: HTMLCanvasElement, ww?: number, wl?: number) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Set canvas size to match container
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || 400; // fallback width
        const height = rect.height || 400; // fallback height
        canvas.width = width;
        canvas.height = height;

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
          // Get image data from the drawn area
          const imageData = ctx.getImageData(x, y, scaledWidth, scaledHeight);
          const adjustedImageData = applyWindowLevel(imageData, ww, wl);
          ctx.putImageData(adjustedImageData, x, y);
        }
        
        resolve();
      };
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      img.src = imageDataUrl;
    });
  }, [applyWindowLevel]);

  useImperativeHandle(ref, () => ({
    resetView: () => {
      // Reset view logic
    },
    setWindowLevel: (ww: number, wl: number) => {
      // Update window/level for all visible images
      updateAllImages(ww, wl);
    }
  }));

  // Convert frames to image IDs
  useEffect(() => {
    if (frames.length === 0) return;

    const newImageIds = frames.map((frame, index) => {
      return `data:image/png;base64,${frame.data}`;
    });

    console.log(`GridViewer: Converted ${frames.length} frames to image IDs`);
    setImageIds(newImageIds);
  }, [frames]);

  // Update all visible images
  const updateAllImages = useCallback(async (ww: number, wl: number) => {
    const totalCells = gridSize * gridSize;
    const updatePromises = [];
    
    for (let i = 0; i < totalCells; i++) {
      const frameIndex = currentFrameIndex + i;
      if (frameIndex < frames.length && canvasRefs.current[i]) {
        const imageDataUrl = imageIds[frameIndex];
        if (imageDataUrl) {
          updatePromises.push(
            loadAndDisplayImage(imageDataUrl, canvasRefs.current[i]!, ww, wl)
              .catch(err => console.error(`Failed to update frame ${frameIndex}:`, err))
          );
        }
      }
    }
    
    try {
      await Promise.all(updatePromises);
    } catch (err) {
      console.error('GridViewer: Error updating images:', err);
    }
  }, [currentFrameIndex, frames.length, imageIds, gridSize, loadAndDisplayImage]);

  // Load images for grid
  useEffect(() => {
    if (imageIds.length === 0 || frames.length === 0) return;

    setIsLoading(true);
    setError(null);

    const totalCells = gridSize * gridSize;

    const loadGridImages = async () => {
      // Wait a bit for canvas elements to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const loadPromises = [];
      
      console.log(`GridViewer: Loading ${totalCells} cells starting from frame ${currentFrameIndex}`);
      console.log(`GridViewer: Available frames: ${frames.length}`);
      
      for (let i = 0; i < totalCells; i++) {
        const frameIndex = currentFrameIndex + i;
        const canvas = canvasRefs.current[i];
        
        if (frameIndex < frames.length && canvas) {
          const imageDataUrl = imageIds[frameIndex];
          if (imageDataUrl) {
            console.log(`GridViewer: Loading frame ${frameIndex} into cell ${i}`);
            loadPromises.push(
              loadAndDisplayImage(imageDataUrl, canvas, windowWidth, windowLevel)
                .catch(err => console.error(`Failed to load frame ${frameIndex}:`, err))
            );
          }
        } else {
          console.log(`GridViewer: Skipping cell ${i} - frameIndex: ${frameIndex}, canvas: ${!!canvas}`);
        }
      }
      
      try {
        await Promise.all(loadPromises);
        console.log(`GridViewer: Successfully loaded ${loadPromises.length} images`);
      } catch (err) {
        console.error('GridViewer: Error loading images:', err);
        setError('Failed to load some images');
      }
      
      setIsLoading(false);
    };

    loadGridImages();
  }, [currentFrameIndex, frames.length, imageIds, gridSize, windowWidth, windowLevel, loadAndDisplayImage]);

  // Handle window/level changes
  useEffect(() => {
    if (windowWidth && windowLevel) {
      updateAllImages(windowWidth, windowLevel);
    }
  }, [windowWidth, windowLevel, updateAllImages]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      updateAllImages(windowWidth, windowLevel);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateAllImages, windowWidth, windowLevel]);

  const totalCells = gridSize * gridSize;
  const gridStyle = {
    gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
    gridTemplateRows: `repeat(${gridSize}, 1fr)`,
  };

  return (
    <GridContainer ref={containerRef} style={gridStyle}>
      {Array.from({ length: totalCells }, (_, i) => {
        const frameIndex = currentFrameIndex + i;
        const frame = frames[frameIndex];
        
        return (
          <GridCell key={i} gridSize={gridSize}>
            {frame && (
              <>
                <Canvas
                  ref={(el) => (canvasRefs.current[i] = el)}
                />
                <FrameInfo
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {frameIndex + 1}
                </FrameInfo>
              </>
            )}
          </GridCell>
        );
      })}

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
          <LoadingText>Loading grid...</LoadingText>
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
    </GridContainer>
  );
});

GridViewer.displayName = 'GridViewer';

export default GridViewer;
