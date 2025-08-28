import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useDICOM } from '../context/DICOMContext';
import SeriesList from './SeriesList';
import Viewer2D, { Viewer2DRef } from './Viewer2D';
import Viewer3D, { Viewer3DRef } from './Viewer3D';
import Controls from './Controls';
import MetadataPanel from './MetadataPanel';

const Container = styled.div`
  height: 100vh;
  display: flex;
  background-color: #0e1117;
  color: #fafafa;
`;

const Sidebar = styled(motion.div)`
  width: 300px;
  background-color: #1a1b23;
  border-right: 1px solid #3d4043;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ViewerContainer = styled.div`
  flex: 1;
  display: flex;
  position: relative;
  background-color: #0e1117;
`;

const Viewer2DContainer = styled(motion.div)<{ isActive: boolean }>`
  flex: 1;
  position: relative;
  display: ${props => props.isActive ? 'block' : 'none'};
`;

const Viewer3DContainer = styled(motion.div)<{ isActive: boolean }>`
  flex: 1;
  position: relative;
  display: ${props => props.isActive ? 'block' : 'none'};
`;

const TopBar = styled.div`
  height: 60px;
  background-color: #1a1b23;
  border-bottom: 1px solid #3d4043;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  color: #fafafa;
  margin: 0;
`;

const ViewToggle = styled.div`
  display: flex;
  background-color: #262730;
  border-radius: 8px;
  padding: 4px;
  gap: 4px;
`;

const ToggleButton = styled.button<{ active: boolean }>`
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px;
  background-color: ${props => props.active ? '#00d4aa' : 'transparent'};
  color: ${props => props.active ? '#0e1117' : '#9ca3af'};
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props => props.active ? '#00b894' : '#3d4043'};
    color: ${props => props.active ? '#0e1117' : '#fafafa'};
  }
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 1rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    color: #fafafa;
    background-color: #3d4043;
  }
`;

const StatusBar = styled.div`
  height: 40px;
  background-color: #1a1b23;
  border-top: 1px solid #3d4043;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  font-size: 0.875rem;
  color: #9ca3af;
`;

const StatusInfo = styled.div`
  display: flex;
  gap: 2rem;
`;

const LoadingOverlay = styled(motion.div)`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(14, 17, 23, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const LoadingSpinner = styled(motion.div)`
  width: 40px;
  height: 40px;
  border: 3px solid #3d4043;
  border-top: 3px solid #00d4aa;
  border-radius: 50%;
  margin-bottom: 1rem;
`;

const LoadingText = styled.div`
  color: #fafafa;
  font-weight: 600;
`;

export default function ViewerPage() {
  const navigate = useNavigate();
  const { state, dispatch, loadSeries } = useDICOM();
  
  const [activeView, setActiveView] = useState<'2d' | '3d'>('2d');
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  
  const viewer2DRef = useRef<Viewer2DRef>(null);
  const viewer3DRef = useRef<Viewer3DRef>(null);

  useEffect(() => {
    if (!state.session) {
      navigate('/');
    }
  }, [state.session, navigate]);

  const handleSeriesSelect = async (seriesUid: string) => {
    setSelectedSeries(seriesUid);
    await loadSeries(seriesUid);
  };

  const handleBackToUpload = () => {
    navigate('/');
  };

  if (!state.session) {
    return null;
  }

  return (
    <Container>
      <Sidebar
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <SeriesList
          series={state.session.series}
          selectedSeries={selectedSeries}
          onSeriesSelect={handleSeriesSelect}
        />
        
        {selectedSeries && (
          <Controls
            series={state.selectedSeries}
            frames={state.frames}
            currentFrameIndex={state.currentFrameIndex}
            windowWidth={state.windowWidth}
            windowLevel={state.windowLevel}
            zoom={state.zoom}
            isPlaying={state.isPlaying}
            playSpeed={state.playSpeed}
            onFrameChange={(index) => dispatch({ type: 'SET_CURRENT_FRAME', payload: index })}
            onWindowWidthChange={(ww) => dispatch({ type: 'SET_WINDOW_WIDTH', payload: ww })}
            onWindowLevelChange={(wl) => dispatch({ type: 'SET_WINDOW_LEVEL', payload: wl })}
            onZoomChange={(zoom) => dispatch({ type: 'SET_ZOOM', payload: zoom })}
            onPlayToggle={() => dispatch({ type: 'SET_PLAYING', payload: !state.isPlaying })}
            onPlaySpeedChange={(speed) => dispatch({ type: 'SET_PLAY_SPEED', payload: speed })}
            onResetView={() => dispatch({ type: 'RESET_VIEW' })}
            onToggleMetadata={() => setShowMetadata(!showMetadata)}
          />
        )}
      </Sidebar>

      <MainContent>
        <TopBar>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <BackButton onClick={handleBackToUpload}>
              ← Back to Upload
            </BackButton>
            <Title>DICOM Viewer</Title>
          </div>
          
          <ViewToggle>
            <ToggleButton
              active={activeView === '2d'}
              onClick={() => setActiveView('2d')}
            >
              2D View
            </ToggleButton>
            <ToggleButton
              active={activeView === '3d'}
              onClick={() => setActiveView('3d')}
            >
              3D View
            </ToggleButton>
          </ViewToggle>
        </TopBar>

        <ViewerContainer>
          <AnimatePresence mode="wait">
            {activeView === '2d' && (
              <Viewer2DContainer
                key="2d"
                isActive={activeView === '2d'}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                transition={{ duration: 0.3 }}
              >
                <Viewer2D
                  ref={viewer2DRef}
                  frames={state.frames}
                  currentFrameIndex={state.currentFrameIndex}
                  windowWidth={state.windowWidth}
                  windowLevel={state.windowLevel}
                  zoom={state.zoom}
                />
              </Viewer2DContainer>
            )}
            
            {activeView === '3d' && (
              <Viewer3DContainer
                key="3d"
                isActive={activeView === '3d'}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.3 }}
              >
                <Viewer3D
                  ref={viewer3DRef}
                  frames={state.frames}
                />
              </Viewer3DContainer>
            )}
          </AnimatePresence>

          {state.isLoading && (
            <LoadingOverlay
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <LoadingSpinner
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <LoadingText>Loading DICOM data...</LoadingText>
            </LoadingOverlay>
          )}
        </ViewerContainer>

        <StatusBar>
          <StatusInfo>
            <span>Series: {state.selectedSeries?.series_desc || 'None selected'}</span>
            <span>Frame: {state.currentFrameIndex + 1} / {state.frames.length}</span>
            <span>Patient: {state.selectedSeries?.patient_name || 'N/A'}</span>
          </StatusInfo>
          <div>
            WW: {state.windowWidth.toFixed(1)} | WL: {state.windowLevel.toFixed(1)} | Zoom: {state.zoom}%
          </div>
        </StatusBar>
      </MainContent>

      <AnimatePresence>
        {showMetadata && state.selectedSeries && (
          <MetadataPanel
            series={state.selectedSeries}
            onClose={() => setShowMetadata(false)}
          />
        )}
      </AnimatePresence>
    </Container>
  );
}
