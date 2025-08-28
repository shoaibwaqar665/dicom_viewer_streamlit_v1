import React, { forwardRef, useEffect, useRef, useImperativeHandle } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useVTK } from '../context/VTKContext';
import { DICOMFrame } from '../context/DICOMContext';

const ViewerContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
  background-color: #000000;
  overflow: hidden;
`;

const VTKContainer = styled.div`
  width: 100%;
  height: 100%;
  position: relative;
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

const ViewInfo = styled(motion.div)`
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

const ViewControls = styled(motion.div)`
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ControlButton = styled.button`
  background-color: rgba(0, 0, 0, 0.7);
  border: 1px solid #3d4043;
  color: #fafafa;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;

  &:hover {
    background-color: rgba(0, 212, 170, 0.2);
    border-color: #00d4aa;
  }

  &.active {
    background-color: #00d4aa;
    color: #0e1117;
    border-color: #00d4aa;
  }
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

interface Viewer3DProps {
  frames: DICOMFrame[];
}

export interface Viewer3DRef {
  resetCamera: () => void;
  setView: (view: 'volume' | 'axial' | 'coronal' | 'sagittal') => void;
  setBackground: (color: [number, number, number]) => void;
}

const Viewer3D = forwardRef<Viewer3DRef, Viewer3DProps>(({ frames }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const vtkContainerRef = useRef<HTMLDivElement>(null);
  const { state: vtkState, initializeVTK, resetCamera, setBackground } = useVTK();
  
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [currentView, setCurrentView] = React.useState<'volume' | 'axial' | 'coronal' | 'sagittal'>('volume');

  useImperativeHandle(ref, () => ({
    resetCamera: () => {
      resetCamera();
    },
    setView: (view: 'volume' | 'axial' | 'coronal' | 'sagittal') => {
      setCurrentView(view);
      // For now, just log the view change
      console.log(`Switching to ${view} view`);
    },
    setBackground: (color: [number, number, number]) => {
      setBackground(color);
    }
  }));

  // Initialize VTK when component mounts
  useEffect(() => {
    if (vtkContainerRef.current && !vtkState.isInitialized) {
      initializeVTK(vtkContainerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vtkState.isInitialized]); // initializeVTK is stable due to useCallback

  // Process frames for 3D visualization
  useEffect(() => {
    if (frames.length === 0 || !vtkState.isInitialized || isLoading) return;

    const processFrames = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // For now, we'll just display a placeholder message
        // In a full implementation, this would process the frames for 3D rendering
        console.log(`Processing ${frames.length} frames for 3D visualization`);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process frames');
        setIsLoading(false);
      }
    };

    processFrames();
  }, [frames, vtkState.isInitialized, isLoading]); // Added isLoading to prevent multiple processing

  const handleViewChange = (view: 'volume' | 'axial' | 'coronal' | 'sagittal') => {
    setCurrentView(view);
    // For now, just log the view change
    console.log(`Switching to ${view} view`);
  };

  return (
    <ViewerContainer ref={containerRef}>
      <VTKContainer ref={vtkContainerRef} />
      
      <Overlay>
        <ViewInfo
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          3D View: {currentView.toUpperCase()}
          <br />
          Frames: {frames.length}
        </ViewInfo>

        <ViewControls
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <ControlButton
            className={currentView === 'volume' ? 'active' : ''}
            onClick={() => handleViewChange('volume')}
          >
            Volume
          </ControlButton>
          <ControlButton
            className={currentView === 'axial' ? 'active' : ''}
            onClick={() => handleViewChange('axial')}
          >
            Axial
          </ControlButton>
          <ControlButton
            className={currentView === 'coronal' ? 'active' : ''}
            onClick={() => handleViewChange('coronal')}
          >
            Coronal
          </ControlButton>
          <ControlButton
            className={currentView === 'sagittal' ? 'active' : ''}
            onClick={() => handleViewChange('sagittal')}
          >
            Sagittal
          </ControlButton>
        </ViewControls>
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
          <LoadingText>Processing 3D data...</LoadingText>
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
          <LoadingText>No DICOM frames available for 3D rendering</LoadingText>
        </LoadingIndicator>
      )}
    </ViewerContainer>
  );
});

Viewer3D.displayName = 'Viewer3D';

export default Viewer3D;
