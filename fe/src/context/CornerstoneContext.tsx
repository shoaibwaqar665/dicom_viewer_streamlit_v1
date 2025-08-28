import React, { createContext, useContext, useRef, ReactNode, useCallback } from 'react';

interface CornerstoneState {
  isInitialized: boolean;
  container: HTMLElement | null;
}

interface CornerstoneContextType {
  state: CornerstoneState;
  initializeCornerstone: () => Promise<void>;
  setupViewport: (element: HTMLElement, imageIds: string[]) => Promise<void>;
  loadImage: (imageId: string) => Promise<void>;
  setWindowLevel: (windowWidth: number, windowLevel: number) => void;
  setZoom: (zoom: number) => void;
  resetView: () => void;
}

const CornerstoneContext = createContext<CornerstoneContextType | null>(null);

export function CornerstoneProvider({ children }: { children: ReactNode }) {
  const [state, setState] = React.useState<CornerstoneState>({
    isInitialized: false,
    container: null,
  });

  const containerRef = useRef<HTMLElement | null>(null);

  const initializeCornerstone = useCallback(async () => {
    if (state.isInitialized) return;

    try {
      // For now, just mark as initialized
      // In a full implementation, this would initialize Cornerstone.js
      console.log('Initializing Cornerstone.js...');
      setState(prev => ({ ...prev, isInitialized: true }));
    } catch (error) {
      console.error('Failed to initialize Cornerstone:', error);
    }
  }, [state.isInitialized]);

  const setupViewport = useCallback(async (element: HTMLElement, imageIds: string[]) => {
    if (!state.isInitialized) {
      await initializeCornerstone();
    }

    try {
      containerRef.current = element;
      setState(prev => ({
        ...prev,
        container: element,
      }));
      console.log(`Setting up viewport with ${imageIds.length} images`);
    } catch (error) {
      console.error('Failed to setup viewport:', error);
    }
  }, [state.isInitialized, initializeCornerstone]);

  const loadImage = useCallback(async (imageId: string) => {
    console.log('Loading image:', imageId);
  }, []);

  const setWindowLevel = useCallback((windowWidth: number, windowLevel: number) => {
    console.log(`Setting window/level: WW=${windowWidth}, WL=${windowLevel}`);
  }, []);

  const setZoom = useCallback((zoom: number) => {
    console.log(`Setting zoom: ${zoom}%`);
  }, []);

  const resetView = useCallback(() => {
    console.log('Resetting view');
  }, []);

  return (
    <CornerstoneContext.Provider
      value={{
        state,
        initializeCornerstone,
        setupViewport,
        loadImage,
        setWindowLevel,
        setZoom,
        resetView,
      }}
    >
      {children}
    </CornerstoneContext.Provider>
  );
}

export function useCornerstone() {
  const context = useContext(CornerstoneContext);
  if (!context) {
    throw new Error('useCornerstone must be used within a CornerstoneProvider');
  }
  return context;
}