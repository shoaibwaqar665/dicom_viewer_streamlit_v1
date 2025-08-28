import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import UploadPage from './components/UploadPage';
import ViewerPage from './components/ViewerPage';
import { DICOMContextProvider } from './context/DICOMContext';
import { CornerstoneProvider } from './context/CornerstoneContext';
import { VTKProvider } from './context/VTKContext';

const AppContainer = styled.div`
  height: 100vh;
  width: 100vw;
  background-color: #0e1117;
  color: #fafafa;
  overflow: hidden;
`;

const LoadingScreen = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #0e1117;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const LoadingSpinner = styled(motion.div)`
  width: 50px;
  height: 50px;
  border: 3px solid #3d4043;
  border-top: 3px solid #00d4aa;
  border-radius: 50%;
  margin-bottom: 1rem;
`;

const LoadingText = styled(motion.h2)`
  color: #fafafa;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const LoadingSubtext = styled(motion.p)`
  color: #9ca3af;
  font-size: 0.875rem;
`;

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('Initializing DICOM Viewer...');

  useEffect(() => {
    // Simulate initialization time
    const initSteps = [
      'Loading Cornerstone.js...',
      'Initializing VTK.js...',
      'Setting up DICOM parser...',
      'Preparing viewer components...',
      'Ready!'
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < initSteps.length) {
        setLoadingText(initSteps[currentStep]);
        currentStep++;
      } else {
        setIsLoading(false);
        clearInterval(interval);
      }
    }, 800);

    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <LoadingScreen
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      >
        <LoadingSpinner
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <LoadingText
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {loadingText}
        </LoadingText>
        <LoadingSubtext
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          Advanced medical imaging viewer with 2D and 3D capabilities
        </LoadingSubtext>
      </LoadingScreen>
    );
  }

  return (
    <AppContainer>
      <DICOMContextProvider>
        <CornerstoneProvider>
          <VTKProvider>
            <Router>
              <AnimatePresence mode="wait">
                <Routes>
                  <Route path="/" element={<UploadPage />} />
                  <Route path="/viewer" element={<ViewerPage />} />
                </Routes>
              </AnimatePresence>
            </Router>
          </VTKProvider>
        </CornerstoneProvider>
      </DICOMContextProvider>
    </AppContainer>
  );
}

export default App;
