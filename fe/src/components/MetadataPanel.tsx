import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { DICOMSeries } from '../context/DICOMContext';

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
`;

const Panel = styled(motion.div)`
  background-color: #1a1b23;
  border: 1px solid #3d4043;
  border-radius: 12px;
  width: 100%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  padding: 1.5rem;
  border-bottom: 1px solid #3d4043;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.h2`
  font-size: 1.5rem;
  font-weight: 600;
  color: #fafafa;
  margin: 0;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: #9ca3af;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    color: #fafafa;
    background-color: #3d4043;
  }
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const Section = styled.div`
  margin-bottom: 2rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const SectionTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #fafafa;
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #3d4043;
`;

const MetadataGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
`;

const MetadataItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const MetadataLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  color: #9ca3af;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const MetadataValue = styled.div`
  font-size: 0.875rem;
  color: #fafafa;
  word-break: break-word;
`;

const FullWidthItem = styled.div`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const EmptyValue = styled.span`
  color: #6b7280;
  font-style: italic;
`;

const TagInfo = styled.div`
  background-color: rgba(0, 212, 170, 0.1);
  border: 1px solid rgba(0, 212, 170, 0.3);
  border-radius: 6px;
  padding: 1rem;
  margin-top: 1rem;
`;

const TagInfoTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #00d4aa;
  margin-bottom: 0.5rem;
`;

const TagInfoText = styled.div`
  font-size: 0.75rem;
  color: #9ca3af;
  line-height: 1.4;
`;

interface MetadataPanelProps {
  series: DICOMSeries;
  onClose: () => void;
}

export default function MetadataPanel({ series, onClose }: MetadataPanelProps) {
  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return <EmptyValue>Not specified</EmptyValue>;
    }
    return String(value);
  };

  return (
    <Overlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <Panel
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <Header>
          <Title>DICOM Metadata</Title>
          <CloseButton onClick={onClose}>
            ×
          </CloseButton>
        </Header>

        <Content>
          <Section>
            <SectionTitle>Patient Information</SectionTitle>
            <MetadataGrid>
              <MetadataItem>
                <MetadataLabel>Patient Name</MetadataLabel>
                <MetadataValue>{formatValue(series.patient_name)}</MetadataValue>
              </MetadataItem>
              <MetadataItem>
                <MetadataLabel>Patient ID</MetadataLabel>
                <MetadataValue>{formatValue(series.patient_id)}</MetadataValue>
              </MetadataItem>
            </MetadataGrid>
          </Section>

          <Section>
            <SectionTitle>Study Information</SectionTitle>
            <MetadataGrid>
              <FullWidthItem>
                <MetadataLabel>Study Description</MetadataLabel>
                <MetadataValue>{formatValue(series.study_desc)}</MetadataValue>
              </FullWidthItem>
            </MetadataGrid>
          </Section>

          <Section>
            <SectionTitle>Series Information</SectionTitle>
            <MetadataGrid>
              <MetadataItem>
                <MetadataLabel>Series Description</MetadataLabel>
                <MetadataValue>{formatValue(series.series_desc)}</MetadataValue>
              </MetadataItem>
              <MetadataItem>
                <MetadataLabel>Modality</MetadataLabel>
                <MetadataValue>{formatValue(series.modality)}</MetadataValue>
              </MetadataItem>
              <MetadataItem>
                <MetadataLabel>Series UID</MetadataLabel>
                <MetadataValue style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                  {formatValue(series.uid)}
                </MetadataValue>
              </MetadataItem>
              <MetadataItem>
                <MetadataLabel>Frame Count</MetadataLabel>
                <MetadataValue>{formatValue(series.frame_count)}</MetadataValue>
              </MetadataItem>
            </MetadataGrid>
          </Section>

          {series.examples && series.examples.length > 0 && (
            <Section>
              <SectionTitle>Example Files</SectionTitle>
              <MetadataGrid>
                <FullWidthItem>
                  <MetadataLabel>Sample Files</MetadataLabel>
                  <MetadataValue>
                    {series.examples.slice(0, 5).map((example, index) => (
                      <div key={index} style={{ marginBottom: '0.25rem' }}>
                        {example}
                      </div>
                    ))}
                    {series.examples.length > 5 && (
                      <div style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                        ... and {series.examples.length - 5} more files
                      </div>
                    )}
                  </MetadataValue>
                </FullWidthItem>
              </MetadataGrid>
            </Section>
          )}

          <TagInfo>
            <TagInfoTitle>About DICOM Tags</TagInfoTitle>
            <TagInfoText>
              DICOM (Digital Imaging and Communications in Medicine) is the standard for handling, 
              storing, printing, and transmitting information in medical imaging. Each DICOM file 
              contains metadata tags that describe the image data, patient information, and acquisition 
              parameters. This metadata is essential for proper image interpretation and clinical workflow.
            </TagInfoText>
          </TagInfo>
        </Content>
      </Panel>
    </Overlay>
  );
}
