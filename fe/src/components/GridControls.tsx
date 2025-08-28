import React, { useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const ControlsContainer = styled(motion.div)`
  background-color: #1a1a1a;
  border: 1px solid #3d4043;
  border-radius: 12px;
  padding: 1rem;
  height: calc(100vh - 120px);
  overflow-y: auto;
  flex: 1;
  
  @media (max-width: 768px) {
    padding: 0.75rem;
    height: calc(100vh - 100px);
  }
  
  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: #1a1a1a;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #3d4043;
    border-radius: 3px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: #00d4aa;
  }
`;

const Section = styled.div`
  margin-bottom: 1rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const Slider = styled.input`
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #3d4043;
  outline: none;
  -webkit-appearance: none;
  transition: all 0.1s ease;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #00d4aa;
    cursor: pointer;
    transition: all 0.1s ease;
  }
  
  &::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #00d4aa;
    cursor: pointer;
    border: none;
    transition: all 0.1s ease;
  }
  
  &:active {
    &::-webkit-slider-thumb {
      transform: scale(1.1);
    }
    &::-moz-range-thumb {
      transform: scale(1.1);
    }
  }
`;

const CellContainer = styled.div`
  background-color: #262730;
  border: 1px solid #3d4043;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  
  @media (max-width: 768px) {
    padding: 0.75rem;
  }
`;

const CellHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const CellContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const SliderContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SliderLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
  color: #fafafa;
`;

const SliderValue = styled.span`
  background-color: #3d4043;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  min-width: 40px;
  text-align: center;
`;

const SectionTitle = styled.h3`
  color: #fafafa;
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const ControlRow = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
`;

const Label = styled.label`
  color: #fafafa;
  font-weight: 500;
  min-width: 80px;
  font-size: 0.875rem;
`;

const Input = styled.input`
  background-color: #262730;
  border: 1px solid #3d4043;
  border-radius: 6px;
  color: #fafafa;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  min-width: 80px;
  
  &:focus {
    outline: none;
    border-color: #00d4aa;
    box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.1);
  }
`;

const Button = styled.button`
  background-color: #262730;
  border: 1px solid #3d4043;
  border-radius: 6px;
  color: #fafafa;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: #3d4043;
    border-color: #00d4aa;
  }
  
  &:active {
    transform: translateY(1px);
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const FrameSelector = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FrameInput = styled.input`
  background-color: #262730;
  border: 1px solid #3d4043;
  border-radius: 6px;
  color: #fafafa;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  width: 80px;
  
  &:focus {
    outline: none;
    border-color: #00d4aa;
    box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.1);
  }
`;

const CellControls = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
`;

const CellControl = styled.div`
  background-color: #262730;
  border: 1px solid #3d4043;
  border-radius: 8px;
  padding: 1rem;
`;

const CellTitle = styled.h4`
  color: #fafafa;
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
  text-align: center;
`;

const CellInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const CellInputRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CellLabel = styled.label`
  color: #fafafa;
  font-size: 0.75rem;
  min-width: 30px;
`;

const CellInput = styled.input`
  background-color: #1a1a1a;
  border: 1px solid #3d4043;
  border-radius: 4px;
  color: #fafafa;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  width: 60px;
  
  &:focus {
    outline: none;
    border-color: #00d4aa;
  }
`;

interface GridControlsProps {
  session: any;
  selectedSeriesForCells: { [cellIndex: number]: { seriesUid: string; frameIndex: number } };
  cellWindowLevels: { [cellIndex: number]: { windowWidth: number; windowLevel: number } };
  cellFrames: { [cellIndex: number]: any[] };
  onSeriesChange: (cellIndex: number, seriesUid: string, frameIndex: number) => void;
  onWindowLevelChange: (cellIndex: number, windowWidth: number, windowLevel: number) => void;
  onResetAll: () => void;
  onBackTo1x1: () => void;
}

const GridControls: React.FC<GridControlsProps> = ({
  session,
  selectedSeriesForCells,
  cellWindowLevels,
  cellFrames,
  onSeriesChange,
  onWindowLevelChange,
  onResetAll,
  onBackTo1x1
}) => {
  console.log('GridControls: Component rendered with:', { selectedSeriesForCells, cellWindowLevels, cellFrames });
  const [tempSeries, setTempSeries] = useState<{ [cellIndex: number]: { seriesUid: string; frameIndex: number } }>(selectedSeriesForCells);

  const handleSeriesChange = (cellIndex: number, seriesUid: string) => {
    console.log(`GridControls: Changing cell ${cellIndex} to series ${seriesUid}`);
    setTempSeries(prev => ({
      ...prev,
      [cellIndex]: { ...prev[cellIndex], seriesUid, frameIndex: 0 }
    }));
    onSeriesChange(cellIndex, seriesUid, 0);
  };

  // Get available series for a cell (excluding already selected ones)
  const getAvailableSeries = (currentCellIndex: number) => {
    if (!session?.series) return [];
    
    const selectedSeriesUids = Object.values(selectedSeriesForCells)
      .map(cell => cell.seriesUid)
      .filter((uid, index) => index !== currentCellIndex && uid); // Exclude current cell's selection
    
    return session.series.filter((series: any) => !selectedSeriesUids.includes(series.uid));
  };

  const handleFrameChange = (cellIndex: number, value: string) => {
    const frameIndex = Math.max(0, parseInt(value) || 0);
    const currentSeries = selectedSeriesForCells[cellIndex];
    if (currentSeries) {
      console.log(`GridControls: Changing cell ${cellIndex} to frame ${frameIndex}`);
      setTempSeries(prev => ({
        ...prev,
        [cellIndex]: { ...prev[cellIndex], frameIndex }
      }));
      onSeriesChange(cellIndex, currentSeries.seriesUid, frameIndex);
    }
  };

  const handleWindowLevelChange = (cellIndex: number, type: 'windowWidth' | 'windowLevel', value: string) => {
    const numValue = parseFloat(value) || 0;
    const current = cellWindowLevels[cellIndex] || { windowWidth: 400, windowLevel: 50 };
    
    if (type === 'windowWidth') {
      console.log(`GridControls: Changing cell ${cellIndex} WW to ${numValue}`);
      onWindowLevelChange(cellIndex, numValue, current.windowLevel);
    } else {
      console.log(`GridControls: Changing cell ${cellIndex} WL to ${numValue}`);
      onWindowLevelChange(cellIndex, current.windowWidth, numValue);
    }
  };

  const resetAllSeries = () => {
    if (session && session.series && session.series.length > 0) {
      const defaultSeries = session.series.slice(0, 4);
      const newTempSeries: { [cellIndex: number]: { seriesUid: string; frameIndex: number } } = {};
      defaultSeries.forEach((series: any, cellIndex: number) => {
        newTempSeries[cellIndex] = { seriesUid: series.uid, frameIndex: 0 };
        onSeriesChange(cellIndex, series.uid, 0);
      });
      setTempSeries(newTempSeries);
    }
  };

  return (
    <ControlsContainer
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Section>
        <ControlRow>
          <Button 
            onClick={onBackTo1x1}
            style={{ 
              backgroundColor: '#00d4aa', 
              color: '#000',
              fontWeight: '600',
              width: '100%'
            }}
          >
            ← Back to 1×1 Layout
          </Button>
        </ControlRow>
      </Section>
      
      {[0, 1, 2, 3].map(cellIndex => {
        const currentSeries = selectedSeriesForCells[cellIndex];
        const availableFrames = cellFrames[cellIndex] || [];
        const cellWL = cellWindowLevels[cellIndex] || { windowWidth: 400, windowLevel: 50 };
        const availableSeries = getAvailableSeries(cellIndex);
        
        return (
          <CellContainer key={cellIndex}>
            <CellHeader>
              <Label>File {cellIndex + 1}:</Label>
              <select
                value={currentSeries?.seriesUid || ''}
                onChange={(e) => handleSeriesChange(cellIndex, e.target.value)}
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #3d4043',
                  borderRadius: '6px',
                  color: '#fafafa',
                  padding: '0.5rem',
                  minWidth: '200px',
                  flex: 1
                }}
              >
                <option value="">Select File</option>
                {availableSeries.map((series: any) => (
                  <option key={series.uid} value={series.uid}>
                    {series.series_desc || `File ${series.uid.slice(-8)}`}
                  </option>
                ))}
              </select>
            </CellHeader>
            
            {currentSeries?.seriesUid && availableFrames.length > 0 && (
              <CellContent>
                <SliderContainer>
                  <SliderLabel>
                    <span>Frame:</span>
                    <SliderValue>{currentSeries.frameIndex + 1} / {availableFrames.length}</SliderValue>
                  </SliderLabel>
                  <Slider
                    type="range"
                    min="0"
                    max={availableFrames.length - 1}
                    step="1"
                    value={currentSeries.frameIndex || 0}
                    onChange={(e) => handleFrameChange(cellIndex, e.target.value)}
                  />
                </SliderContainer>
                
                <ControlRow>
                  <Label>WW:</Label>
                  <Input
                    type="number"
                    min="1"
                    max="2000"
                    step="1"
                    value={cellWL.windowWidth}
                    onChange={(e) => handleWindowLevelChange(cellIndex, 'windowWidth', e.target.value)}
                  />
                  <Label>WL:</Label>
                  <Input
                    type="number"
                    min="-1000"
                    max="1000"
                    step="1"
                    value={cellWL.windowLevel}
                    onChange={(e) => handleWindowLevelChange(cellIndex, 'windowLevel', e.target.value)}
                  />
                </ControlRow>
              </CellContent>
            )}
          </CellContainer>
        );
      })}
      
      <Section>
        <ControlRow>
          <Button onClick={resetAllSeries}>
            Reset All Files
          </Button>
        </ControlRow>
      </Section>

      <Section>
        <ControlRow>
          <Button onClick={onResetAll}>
            Reset All Window/Level
          </Button>
        </ControlRow>
      </Section>
    </ControlsContainer>
  );
};

export default GridControls;
