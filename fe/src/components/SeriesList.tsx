import React from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { DICOMSeries } from '../context/DICOMContext';

const Container = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
`;

const Header = styled.div`
  padding: 1rem;
  border-bottom: 1px solid #3d4043;
  margin-bottom: 1rem;
`;

const Title = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: #fafafa;
  margin: 0 0 0.5rem 0;
`;

const Subtitle = styled.p`
  font-size: 0.875rem;
  color: #9ca3af;
  margin: 0;
`;

const SeriesListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const SeriesItem = styled(motion.button)<{ selected: boolean }>`
  background-color: ${props => props.selected ? 'rgba(0, 212, 170, 0.2)' : 'rgba(26, 27, 35, 0.8)'};
  border: 1px solid ${props => props.selected ? '#00d4aa' : '#3d4043'};
  border-radius: 8px;
  padding: 1rem;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #fafafa;

  &:hover {
    background-color: ${props => props.selected ? 'rgba(0, 212, 170, 0.3)' : 'rgba(38, 39, 48, 0.8)'};
    border-color: #00d4aa;
    transform: translateY(-1px);
  }
`;

const SeriesHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
`;

const SeriesTitle = styled.div`
  font-weight: 600;
  color: #fafafa;
  font-size: 0.875rem;
`;

const Modality = styled.div`
  background-color: #00d4aa;
  color: #0e1117;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
`;

const SeriesInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #9ca3af;
`;

const InfoLabel = styled.span`
  font-weight: 500;
`;

const InfoValue = styled.span`
  color: #fafafa;
`;

const FrameCount = styled.div`
  background-color: rgba(0, 212, 170, 0.2);
  color: #00d4aa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 0.5rem;
  text-align: center;
`;

const EmptyState = styled(motion.div)`
  text-align: center;
  padding: 2rem;
  color: #9ca3af;
`;

const EmptyIcon = styled.div`
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
`;

const EmptyText = styled.div`
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const EmptySubtext = styled.div`
  font-size: 0.875rem;
`;

interface SeriesListProps {
  series: DICOMSeries[];
  selectedSeries: string | null;
  onSeriesSelect: (seriesUid: string) => void;
}

export default function SeriesList({ series, selectedSeries, onSeriesSelect }: SeriesListProps) {
  if (series.length === 0) {
    return (
      <Container>
        <Header>
          <Title>DICOM Series</Title>
          <Subtitle>No series available</Subtitle>
        </Header>
        <EmptyState
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <EmptyIcon>📁</EmptyIcon>
          <EmptyText>No DICOM Series Found</EmptyText>
          <EmptySubtext>Upload ZIP files containing DICOM data to view series</EmptySubtext>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>DICOM Series</Title>
        <Subtitle>{series.length} series available</Subtitle>
      </Header>
      
      <SeriesListContainer>
        <AnimatePresence>
          {series.map((seriesItem, index) => (
            <SeriesItem
              key={seriesItem.uid}
              selected={selectedSeries === seriesItem.uid}
              onClick={() => onSeriesSelect(seriesItem.uid)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <SeriesHeader>
                <SeriesTitle>
                  {seriesItem.series_desc || 'Unnamed Series'}
                </SeriesTitle>
                <Modality>{seriesItem.modality}</Modality>
              </SeriesHeader>
              
              <SeriesInfo>
                <InfoRow>
                  <InfoLabel>Patient:</InfoLabel>
                  <InfoValue>{seriesItem.patient_name}</InfoValue>
                </InfoRow>
                <InfoRow>
                  <InfoLabel>ID:</InfoLabel>
                  <InfoValue>{seriesItem.patient_id}</InfoValue>
                </InfoRow>
                <InfoRow>
                  <InfoLabel>Study:</InfoLabel>
                  <InfoValue>{seriesItem.study_desc || 'N/A'}</InfoValue>
                </InfoRow>
              </SeriesInfo>
              
              <FrameCount>
                {seriesItem.frame_count} frames
              </FrameCount>
            </SeriesItem>
          ))}
        </AnimatePresence>
      </SeriesListContainer>
    </Container>
  );
}
