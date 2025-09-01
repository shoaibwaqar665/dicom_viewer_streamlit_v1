import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import axios from 'axios';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

// Types
export interface DICOMSeries {
  uid: string;
  series_desc: string;
  modality: string;
  patient_name: string;
  patient_id: string;
  study_desc: string;
  frame_count: number;
  examples: string[];
}

export interface DICOMFrame {
  index: number;
  data: string;
  width: number;
  height: number;
}

export interface DICOMSession {
  session_id: string;
  series: DICOMSeries[];
  invalid_files: string[];
  total_series: number;
}

export interface DICOMState {
  session: DICOMSession | null;
  selectedSeries: DICOMSeries | null;
  frames: DICOMFrame[];
  currentFrameIndex: number;
  isLoading: boolean;
  error: string | null;
  windowWidth: number;
  windowLevel: number;
  gridSize: number;
  selectedSeriesForCells: { [cellIndex: number]: { seriesUid: string; frameIndex: number } }; // For 2x2 grid: different series for each cell
  cellWindowLevels: { [cellIndex: number]: { windowWidth: number; windowLevel: number } }; // Individual WW/WL for each cell
  cellFrames: { [cellIndex: number]: DICOMFrame[] }; // Frames for each cell (different series)
}

// Actions
type DICOMAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_SESSION'; payload: DICOMSession }
  | { type: 'SET_SELECTED_SERIES'; payload: DICOMSeries }
  | { type: 'SET_FRAMES'; payload: DICOMFrame[] }
  | { type: 'SET_CURRENT_FRAME'; payload: number }
  | { type: 'SET_WINDOW_WIDTH'; payload: number }
  | { type: 'SET_WINDOW_LEVEL'; payload: number }
  | { type: 'SET_GRID_SIZE'; payload: number }
  | { type: 'SET_CELL_SERIES'; payload: { cellIndex: number; seriesUid: string; frameIndex: number } }
  | { type: 'SET_CELL_WINDOW_LEVEL'; payload: { cellIndex: number; windowWidth: number; windowLevel: number } }
  | { type: 'SET_CELL_FRAMES'; payload: { cellIndex: number; frames: DICOMFrame[] } }
  | { type: 'NEXT_FRAME' }
  | { type: 'PREV_FRAME' }
  | { type: 'RESET_VIEW' };

// Initial state
const initialState: DICOMState = {
  session: null,
  selectedSeries: null,
  frames: [],
  currentFrameIndex: 0,
  isLoading: false,
  error: null,
  windowWidth: 400,
  windowLevel: 50,
  gridSize: 1,
  selectedSeriesForCells: {
    0: { seriesUid: '', frameIndex: 0 },
    1: { seriesUid: '', frameIndex: 0 },
    2: { seriesUid: '', frameIndex: 0 },
    3: { seriesUid: '', frameIndex: 0 }
  },
  cellWindowLevels: {
    0: { windowWidth: 400, windowLevel: 50 },
    1: { windowWidth: 400, windowLevel: 50 },
    2: { windowWidth: 400, windowLevel: 50 },
    3: { windowWidth: 400, windowLevel: 50 }
  },
  cellFrames: {
    0: [],
    1: [],
    2: [],
    3: []
  },
};

// Reducer
function dicomReducer(state: DICOMState, action: DICOMAction): DICOMState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };
    case 'SET_SESSION':
      return { ...state, session: action.payload, error: null };
    case 'SET_SELECTED_SERIES':
      return { ...state, selectedSeries: action.payload };
    case 'SET_FRAMES':
      return { 
        ...state, 
        frames: action.payload, 
        currentFrameIndex: 0
      };
    case 'SET_CURRENT_FRAME':
      return { ...state, currentFrameIndex: Math.max(0, Math.min(action.payload, state.frames.length - 1)) };
    case 'SET_WINDOW_WIDTH':
      return { ...state, windowWidth: action.payload };
    case 'SET_WINDOW_LEVEL':
      return { ...state, windowLevel: action.payload };
    case 'SET_GRID_SIZE':
      return { ...state, gridSize: Math.max(1, Math.min(2, action.payload)) };
    case 'SET_CELL_SERIES':
      return {
        ...state,
        selectedSeriesForCells: {
          ...state.selectedSeriesForCells,
          [action.payload.cellIndex]: {
            seriesUid: action.payload.seriesUid,
            frameIndex: action.payload.frameIndex
          }
        }
      };
    case 'SET_CELL_WINDOW_LEVEL':
      return {
        ...state,
        cellWindowLevels: {
          ...state.cellWindowLevels,
          [action.payload.cellIndex]: {
            windowWidth: action.payload.windowWidth,
            windowLevel: action.payload.windowLevel
          }
        }
      };
    case 'SET_CELL_FRAMES':
      return {
        ...state,
        cellFrames: {
          ...state.cellFrames,
          [action.payload.cellIndex]: action.payload.frames
        }
      };
    case 'NEXT_FRAME':
      return { ...state, currentFrameIndex: Math.min(state.currentFrameIndex + 1, state.frames.length - 1) };
    case 'PREV_FRAME':
      return { ...state, currentFrameIndex: Math.max(state.currentFrameIndex - 1, 0) };
    case 'RESET_VIEW':
      return { 
        ...state, 
        windowWidth: 400, 
        windowLevel: 50,
        cellWindowLevels: {
          0: { windowWidth: 400, windowLevel: 50 },
          1: { windowWidth: 400, windowLevel: 50 },
          2: { windowWidth: 400, windowLevel: 50 },
          3: { windowWidth: 400, windowLevel: 50 }
        }
      };
    default:
      return state;
  }
}

// Context
const DICOMContext = createContext<{
  state: DICOMState;
  dispatch: React.Dispatch<DICOMAction>;
  uploadFiles: (files: File[]) => Promise<void>;
  loadSeries: (seriesUid: string) => Promise<void>;
  loadFrame: (frameIndex: number) => Promise<void>;
  loadSeriesForCell: (cellIndex: number, seriesUid: string, frameIndex: number) => Promise<void>;
} | null>(null);

// Provider
export function DICOMContextProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(dicomReducer, initialState);

  const uploadFiles = async (files: File[]) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });

      const response = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      dispatch({ type: 'SET_SESSION', payload: response.data });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload files';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  };

  const loadSeries = async (seriesUid: string) => {
    if (!state.session) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await axios.get(`${API_BASE_URL}/api/series/${state.session.session_id}/${seriesUid}`);
      
      const series = state.session.series.find(s => s.uid === seriesUid);
      if (series) {
        dispatch({ type: 'SET_SELECTED_SERIES', payload: series });
      }
      
      dispatch({ type: 'SET_FRAMES', payload: response.data.frames });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load series';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  };

  const loadFrame = async (frameIndex: number) => {
    if (!state.session || !state.selectedSeries) return;

    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/series/${state.session.session_id}/${state.selectedSeries.uid}/frame/${frameIndex}`
      );
      
      // Update the specific frame in the frames array
      const updatedFrames = [...state.frames];
      updatedFrames[frameIndex] = response.data;
      dispatch({ type: 'SET_FRAMES', payload: updatedFrames });
    } catch (error) {
      console.error('Failed to load frame:', error);
    }
  };

  const loadSeriesForCell = async (cellIndex: number, seriesUid: string, frameIndex: number) => {
    if (!state.session) return;

    try {
      const response = await axios.get(`${API_BASE_URL}/api/series/${state.session.session_id}/${seriesUid}`);
      
      // Set the series and frame for this cell
      dispatch({ 
        type: 'SET_CELL_SERIES', 
        payload: { cellIndex, seriesUid, frameIndex } 
      });
      
      // Load the frames for this cell
      dispatch({ 
        type: 'SET_CELL_FRAMES', 
        payload: { cellIndex, frames: response.data.frames } 
      });
    } catch (error) {
      console.error('Failed to load series for cell:', error);
    }
  };

  return (
    <DICOMContext.Provider value={{ state, dispatch, uploadFiles, loadSeries, loadFrame, loadSeriesForCell }}>
      {children}
    </DICOMContext.Provider>
  );
}

// Hook
export function useDICOM() {
  const context = useContext(DICOMContext);
  if (!context) {
    throw new Error('useDICOM must be used within a DICOMContextProvider');
  }
  return context;
}
