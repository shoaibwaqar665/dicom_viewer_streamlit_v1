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
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 2px;
  padding: 2px;
  
  @media (max-width: 768px) {
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    scroll-snap-type: x mandatory;
  }
`;

const GridCell = styled.div<{ gridSize: number; borderColor: string }>`
  position: relative;
  background-color: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  width: 100%;
  height: 100%;
  border: 2px solid ${props => props.borderColor};
  border-radius: 5px;
  
  @media (max-width: 768px) {
    min-width: 100vw;
    min-height: 100%;
    flex-shrink: 0;
    scroll-snap-align: start;
  }
`;

const Canvas = styled.canvas`
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  background-color: #000000;
  display: block;
  border-radius: 3px;
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

const ScrollIndicator = styled.div`
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  z-index: 10;
  
  @media (min-width: 769px) {
    display: none;
  }
`;

const ScrollDot = styled.div<{ active: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: ${props => props.active ? '#00d4aa' : '#3d4043'};
  cursor: pointer;
  transition: background-color 0.2s ease;
`;

const NavigationButton = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background-color: rgba(0, 0, 0, 0.7);
  border: 1px solid #3d4043;
  color: #fafafa;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: rgba(0, 212, 170, 0.2);
    border-color: #00d4aa;
  }
  
  @media (min-width: 769px) {
    display: none;
  }
`;

const PrevButton = styled(NavigationButton)`
  left: 10px;
`;

const NextButton = styled(NavigationButton)`
  right: 10px;
`;

interface GridViewerProps {
  frames: DICOMFrame[];
  currentFrameIndex: number;
  windowWidth: number;
  windowLevel: number;
  gridSize: number;
  selectedSeriesForCells: { [cellIndex: number]: { seriesUid: string; frameIndex: number } };
  cellWindowLevels: { [cellIndex: number]: { windowWidth: number; windowLevel: number } };
  cellFrames: { [cellIndex: number]: DICOMFrame[] };
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
  gridSize,
  selectedSeriesForCells,
  cellWindowLevels,
  cellFrames
}, ref) => {
  console.log('GridViewer: Component rendered with props:', { 
    frames: frames.length, 
    gridSize, 
    selectedSeriesForCells, 
    cellWindowLevels,
    cellFrames
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [currentScrollIndex, setCurrentScrollIndex] = useState(0);

  // Calculate total cells
  const totalCells = gridSize * gridSize;

  // Generate specific colors for each cell
  const getRandomColor = (index: number) => {
    // Specific colors for images 1 and 3
    if (index === 0) return '#5f27cd'; // Purple for Image 1
    if (index === 2) return '#feca57'; // Yellow for Image 3
    
    // Other colors for remaining cells
    const colors = [
      '#00d4aa', // Teal
      '#ff6b6b', // Red
      '#4ecdc4', // Turquoise
      '#45b7d1', // Blue
      '#96ceb4', // Green
      '#ff9ff3', // Pink
      '#54a0ff', // Light Blue
      '#00d2d3', // Cyan
      '#ff9f43', // Orange
      '#10ac84', // Dark Green
    ];
    return colors[index % colors.length];
  };

  // Scroll navigation functions
  const scrollToIndex = useCallback((index: number) => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const cellWidth = container.clientWidth;
    container.scrollTo({
      left: index * cellWidth,
      behavior: 'smooth'
    });
    setCurrentScrollIndex(index);
  }, []);

  const scrollPrev = useCallback(() => {
    const newIndex = Math.max(0, currentScrollIndex - 1);
    scrollToIndex(newIndex);
  }, [currentScrollIndex, scrollToIndex]);

  const scrollNext = useCallback(() => {
    const newIndex = Math.min(totalCells - 1, currentScrollIndex + 1);
    scrollToIndex(newIndex);
  }, [currentScrollIndex, totalCells, scrollToIndex]);

  // Handle scroll events
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const cellWidth = container.clientWidth;
      const scrollLeft = container.scrollLeft;
      const newIndex = Math.round(scrollLeft / cellWidth);
      setCurrentScrollIndex(newIndex);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

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
      updateAllImages();
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

  // Update all visible images with individual window/level
  const updateAllImages = useCallback(async () => {
    const totalCells = gridSize * gridSize;
    const updatePromises = [];
    
    for (let i = 0; i < totalCells; i++) {
      const cellSeries = selectedSeriesForCells[i];
      const cellFrameData = cellFrames[i] || [];
      
      if (cellSeries && cellSeries.seriesUid && cellFrameData.length > 0 && canvasRefs.current[i]) {
        const frameIndex = cellSeries.frameIndex || 0;
        if (frameIndex < cellFrameData.length) {
          const frame = cellFrameData[frameIndex];
          const imageDataUrl = `data:image/png;base64,${frame.data}`;
          const cellWL = cellWindowLevels[i] || { windowWidth: 400, windowLevel: 50 };
          
          updatePromises.push(
            loadAndDisplayImage(imageDataUrl, canvasRefs.current[i]!, cellWL.windowWidth, cellWL.windowLevel)
              .catch(err => console.error(`Failed to update cell ${i}:`, err))
          );
        }
      }
    }
    
    try {
      await Promise.all(updatePromises);
    } catch (err) {
      console.error('GridViewer: Error updating images:', err);
    }
  }, [selectedSeriesForCells, cellFrames, gridSize, cellWindowLevels, loadAndDisplayImage]);

  // Load images for grid
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    const totalCells = gridSize * gridSize;

    const loadGridImages = async () => {
      // Wait a bit for canvas elements to be ready
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const loadPromises = [];
      
      console.log(`GridViewer: Loading ${totalCells} cells with selected series:`, selectedSeriesForCells);
      
      for (let i = 0; i < totalCells; i++) {
        const cellSeries = selectedSeriesForCells[i];
        const cellFrameData = cellFrames[i] || [];
        const canvas = canvasRefs.current[i];
        
        if (cellSeries && cellSeries.seriesUid && cellFrameData.length > 0 && canvas) {
          const frameIndex = cellSeries.frameIndex || 0;
          if (frameIndex < cellFrameData.length) {
            const frame = cellFrameData[frameIndex];
            const imageDataUrl = `data:image/png;base64,${frame.data}`;
            const cellWL = cellWindowLevels[i] || { windowWidth: 400, windowLevel: 50 };
            
            console.log(`GridViewer: Loading cell ${i} - series: ${cellSeries.seriesUid}, frame: ${frameIndex}, WW=${cellWL.windowWidth}, WL=${cellWL.windowLevel}`);
            loadPromises.push(
              loadAndDisplayImage(imageDataUrl, canvas, cellWL.windowWidth, cellWL.windowLevel)
                .catch(err => console.error(`Failed to load cell ${i}:`, err))
            );
          }
        } else {
          console.log(`GridViewer: Skipping cell ${i} - series: ${cellSeries?.seriesUid}, frames: ${cellFrameData.length}, canvas: ${!!canvas}`);
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
  }, [selectedSeriesForCells, cellFrames, gridSize, cellWindowLevels, loadAndDisplayImage]);

  // Handle window/level changes for individual cells
  useEffect(() => {
    updateAllImages();
  }, [updateAllImages]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      updateAllImages();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateAllImages]);

  return (
    <GridContainer ref={containerRef}>
            {Array.from({ length: totalCells }, (_, i) => {
        const cellSeries = selectedSeriesForCells[i];
        const cellFrameData = cellFrames[i] || [];
        const frameIndex = cellSeries?.frameIndex || 0;
        const frame = frameIndex < cellFrameData.length ? cellFrameData[frameIndex] : null;
        const borderColor = getRandomColor(i);

        return (
          <GridCell key={i} gridSize={gridSize} borderColor={borderColor}>
            {frame && cellSeries?.seriesUid && (
              <>
                <Canvas
                  ref={(el) => (canvasRefs.current[i] = el)}
                />
                <FrameInfo
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  File {i + 1}<br/>
                  Frame {frameIndex + 1}
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

      {/* Navigation Controls - Only show on mobile */}
      {totalCells > 1 && (
        <>
          <PrevButton onClick={scrollPrev} disabled={currentScrollIndex === 0}>
            ‹
          </PrevButton>
          <NextButton onClick={scrollNext} disabled={currentScrollIndex === totalCells - 1}>
            ›
          </NextButton>
          <ScrollIndicator>
            {Array.from({ length: totalCells }, (_, i) => (
              <ScrollDot
                key={i}
                active={i === currentScrollIndex}
                onClick={() => scrollToIndex(i)}
              />
            ))}
          </ScrollIndicator>
        </>
      )}
    </GridContainer>
  );
});

GridViewer.displayName = 'GridViewer';

export default GridViewer;
