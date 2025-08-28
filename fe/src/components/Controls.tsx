import React, { useEffect } from 'react';
import styled from 'styled-components';
import { DICOMSeries, DICOMFrame } from '../context/DICOMContext';

const Container = styled.div`
  border-top: 1px solid #3d4043;
  padding: 1rem;
  background-color: #1a1b23;
`;

const Section = styled.div`
  margin-bottom: 1.5rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: #fafafa;
  margin: 0 0 0.75rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const ControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const ControlRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.75rem;
  font-weight: 500;
  color: #9ca3af;
  min-width: 60px;
`;

const Input = styled.input`
  flex: 1;
  background-color: #262730;
  border: 1px solid #3d4043;
  color: #fafafa;
  border-radius: 4px;
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  transition: all 0.2s ease;

  &:focus {
    outline: none;
    border-color: #00d4aa;
    box-shadow: 0 0 0 2px rgba(0, 212, 170, 0.2);
  }
`;

const Slider = styled.input`
  flex: 1;
  height: 4px;
  background: #3d4043;
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    background: #00d4aa;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  &::-webkit-slider-thumb:hover {
    background: #00b894;
    transform: scale(1.1);
  }

  &::-moz-range-thumb {
    width: 16px;
    height: 16px;
    background: #00d4aa;
    border-radius: 50%;
    cursor: pointer;
    border: none;
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' | 'danger' }>`
  background-color: ${props => {
    switch (props.variant) {
      case 'primary': return '#00d4aa';
      case 'danger': return '#f87171';
      default: return '#262730';
    }
  }};
  color: ${props => props.variant === 'primary' ? '#0e1117' : '#fafafa'};
  border: 1px solid ${props => {
    switch (props.variant) {
      case 'primary': return '#00d4aa';
      case 'danger': return '#f87171';
      default: return '#3d4043';
    }
  }};
  border-radius: 4px;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;

  &:hover {
    background-color: ${props => {
      switch (props.variant) {
        case 'primary': return '#00b894';
        case 'danger': return '#ef4444';
        default: return '#3d4043';
      }
    }};
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ValueDisplay = styled.span`
  font-size: 0.75rem;
  color: #fafafa;
  font-weight: 600;
  min-width: 40px;
  text-align: right;
`;

const PlaybackControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PlayButton = styled.button<{ isPlaying: boolean }>`
  background-color: ${props => props.isPlaying ? '#f87171' : '#00d4aa'};
  color: #0e1117;
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: ${props => props.isPlaying ? '#ef4444' : '#00b894'};
    transform: scale(1.1);
  }
`;

const FrameInfo = styled.div`
  background-color: rgba(0, 212, 170, 0.1);
  border: 1px solid rgba(0, 212, 170, 0.3);
  border-radius: 4px;
  padding: 0.5rem;
  margin-bottom: 1rem;
`;

const FrameInfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const FrameInfoLabel = styled.span`
  color: #9ca3af;
  font-weight: 500;
`;

const FrameInfoValue = styled.span`
  color: #00d4aa;
  font-weight: 600;
`;

interface ControlsProps {
  series: DICOMSeries | null;
  frames: DICOMFrame[];
  currentFrameIndex: number;
  windowWidth: number;
  windowLevel: number;
  zoom: number;
  isPlaying: boolean;
  playSpeed: number;
  onFrameChange: (index: number) => void;
  onWindowWidthChange: (ww: number) => void;
  onWindowLevelChange: (wl: number) => void;
  onZoomChange: (zoom: number) => void;
  onPlayToggle: () => void;
  onPlaySpeedChange: (speed: number) => void;
  onResetView: () => void;
  onToggleMetadata: () => void;
}

export default function Controls({
  series,
  frames,
  currentFrameIndex,
  windowWidth,
  windowLevel,
  zoom,
  isPlaying,
  playSpeed,
  onFrameChange,
  onWindowWidthChange,
  onWindowLevelChange,
  onZoomChange,
  onPlayToggle,
  onPlaySpeedChange,
  onResetView,
  onToggleMetadata
}: ControlsProps) {
  // Auto-play effect
  useEffect(() => {
    if (!isPlaying || frames.length === 0) return;

    const interval = setInterval(() => {
      const nextIndex = (currentFrameIndex + 1) % frames.length;
      onFrameChange(nextIndex);
    }, 1000 / playSpeed);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentFrameIndex, frames.length, playSpeed]); // onFrameChange is stable from parent

  const currentFrame = frames[currentFrameIndex];

  return (
    <Container>
      {series && (
        <FrameInfo>
          <FrameInfoRow>
            <FrameInfoLabel>Series:</FrameInfoLabel>
            <FrameInfoValue>{series.series_desc}</FrameInfoValue>
          </FrameInfoRow>
          <FrameInfoRow>
            <FrameInfoLabel>Modality:</FrameInfoLabel>
            <FrameInfoValue>{series.modality}</FrameInfoValue>
          </FrameInfoRow>
          <FrameInfoRow>
            <FrameInfoLabel>Patient:</FrameInfoLabel>
            <FrameInfoValue>{series.patient_name}</FrameInfoValue>
          </FrameInfoRow>
        </FrameInfo>
      )}

      <Section>
        <SectionTitle>Frame Navigation</SectionTitle>
        <ControlGroup>
          <ControlRow>
            <Label>Frame:</Label>
            <Slider
              type="range"
              min={0}
              max={Math.max(0, frames.length - 1)}
              value={currentFrameIndex}
              onChange={(e) => onFrameChange(parseInt(e.target.value))}
            />
            <ValueDisplay>{currentFrameIndex + 1}/{frames.length}</ValueDisplay>
          </ControlRow>
          
          <PlaybackControls>
            <PlayButton
              isPlaying={isPlaying}
              onClick={onPlayToggle}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </PlayButton>
            
            <Label>Speed:</Label>
            <Slider
              type="range"
              min={0.1}
              max={5.0}
              step={0.1}
              value={playSpeed}
              onChange={(e) => onPlaySpeedChange(parseFloat(e.target.value))}
            />
            <ValueDisplay>{playSpeed.toFixed(1)}x</ValueDisplay>
          </PlaybackControls>
        </ControlGroup>
      </Section>

      <Section>
        <SectionTitle>Window/Level</SectionTitle>
        <ControlGroup>
          <ControlRow>
            <Label>WW:</Label>
            <Input
              type="number"
              min={0.1}
              max={1000}
              step={0.1}
              value={windowWidth}
              onChange={(e) => onWindowWidthChange(parseFloat(e.target.value))}
            />
          </ControlRow>
          <ControlRow>
            <Label>WL:</Label>
            <Input
              type="number"
              min={-1000}
              max={1000}
              step={0.1}
              value={windowLevel}
              onChange={(e) => onWindowLevelChange(parseFloat(e.target.value))}
            />
          </ControlRow>
        </ControlGroup>
      </Section>

      <Section>
        <SectionTitle>View Controls</SectionTitle>
        <ControlGroup>
          <ControlRow>
            <Label>Zoom:</Label>
            <Slider
              type="range"
              min={10}
              max={500}
              value={zoom}
              onChange={(e) => onZoomChange(parseInt(e.target.value))}
            />
            <ValueDisplay>{zoom}%</ValueDisplay>
          </ControlRow>
          
          <ButtonGroup>
            <Button onClick={onResetView}>
              Reset View
            </Button>
            <Button onClick={onToggleMetadata}>
              Metadata
            </Button>
          </ButtonGroup>
        </ControlGroup>
      </Section>

      {currentFrame && (
        <Section>
          <SectionTitle>Frame Info</SectionTitle>
          <ControlGroup>
            <FrameInfoRow>
              <FrameInfoLabel>Dimensions:</FrameInfoLabel>
              <FrameInfoValue>{currentFrame.width} × {currentFrame.height}</FrameInfoValue>
            </FrameInfoRow>
            <FrameInfoRow>
              <FrameInfoLabel>Index:</FrameInfoLabel>
              <FrameInfoValue>{currentFrame.index}</FrameInfoValue>
            </FrameInfoRow>
          </ControlGroup>
        </Section>
      )}
    </Container>
  );
}
