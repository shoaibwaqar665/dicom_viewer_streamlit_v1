import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useDICOM } from '../context/DICOMContext';

const Container = styled.div`
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0e1117 0%, #1a1b23 100%);
  padding: 2rem;
`;

const Header = styled(motion.div)`
  text-align: center;
  margin-bottom: 3rem;
`;

const Title = styled(motion.h1)`
  font-size: 3rem;
  font-weight: 700;
  color: #fafafa;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, #00d4aa 0%, #00b894 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
`;

const Subtitle = styled(motion.p)`
  font-size: 1.25rem;
  color: #9ca3af;
  max-width: 600px;
  line-height: 1.6;
`;

const DropzoneContainer = styled(motion.div)<{ isDragActive: boolean; isDragReject: boolean }>`
  width: 100%;
  max-width: 600px;
  height: 300px;
  border: 3px dashed ${props => 
    props.isDragReject ? '#f87171' : 
    props.isDragActive ? '#00d4aa' : '#3d4043'
  };
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: ${props => 
    props.isDragActive ? 'rgba(0, 212, 170, 0.1)' : 
    props.isDragReject ? 'rgba(248, 113, 113, 0.1)' : 
    'rgba(26, 27, 35, 0.5)'
  };
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &:hover {
    border-color: #00d4aa;
    background-color: rgba(0, 212, 170, 0.1);
  }

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
    transition: left 0.5s;
  }

  &:hover::before {
    left: 100%;
  }
`;

const UploadIcon = styled(motion.div)`
  font-size: 4rem;
  color: #00d4aa;
  margin-bottom: 1rem;
`;

const UploadText = styled(motion.div)`
  font-size: 1.25rem;
  font-weight: 600;
  color: #fafafa;
  margin-bottom: 0.5rem;
`;

const UploadSubtext = styled(motion.div)`
  font-size: 0.875rem;
  color: #9ca3af;
  text-align: center;
  max-width: 400px;
`;

const FileList = styled(motion.div)`
  width: 100%;
  max-width: 600px;
  margin-top: 2rem;
`;

const FileItem = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  background-color: rgba(26, 27, 35, 0.8);
  border: 1px solid #3d4043;
  border-radius: 8px;
  margin-bottom: 0.5rem;
`;

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const FileIcon = styled.div`
  font-size: 1.5rem;
  color: #00d4aa;
`;

const FileDetails = styled.div`
  display: flex;
  flex-direction: column;
`;

const FileName = styled.div`
  font-weight: 600;
  color: #fafafa;
`;

const FileSize = styled.div`
  font-size: 0.875rem;
  color: #9ca3af;
`;

const UploadButton = styled(motion.button)`
  background: linear-gradient(135deg, #00d4aa 0%, #00b894 100%);
  color: #0e1117;
  border: none;
  border-radius: 8px;
  padding: 1rem 2rem;
  font-size: 1.125rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: 2rem;
  transition: all 0.3s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 212, 170, 0.3);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const LoadingSpinner = styled(motion.div)`
  width: 20px;
  height: 20px;
  border: 2px solid #3d4043;
  border-top: 2px solid #00d4aa;
  border-radius: 50%;
  margin-right: 0.5rem;
`;

const ErrorMessage = styled(motion.div)`
  background-color: rgba(248, 113, 113, 0.1);
  border: 1px solid #f87171;
  color: #f87171;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 1rem;
  text-align: center;
`;

const ProgressContainer = styled(motion.div)`
  width: 100%;
  max-width: 600px;
  margin: 1.5rem 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 12px;
  background-color: rgba(26, 27, 35, 0.8);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #3d4043;
`;

const ProgressFill = styled.div<{ progress: number }>`
  height: 100%;
  background: linear-gradient(90deg, #00d4aa, #00b894);
  border-radius: 6px;
  transition: width 0.3s ease;
  width: ${props => props.progress}%;
  position: relative;
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    animation: shimmer 2s infinite;
  }
  
  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
`;

const ProgressText = styled.div`
  font-size: 0.875rem;
  color: #9ca3af;
  font-weight: 500;
`;

export default function UploadPage() {
  const navigate = useNavigate();
  const { state, uploadFiles } = useDICOM();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // Debug logging
  console.log('UploadPage state:', {
    isLoading: state.isLoading,
    uploadProgress: state.uploadProgress,
    error: state.error
  });

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      console.warn('Some files were rejected:', rejectedFiles);
    }
    setSelectedFiles(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/zip': ['.zip']
    },
    multiple: true
  });

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    try {
      await uploadFiles(selectedFiles);
      navigate('/viewer');
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Container>
      <Header
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <Title
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          DICOM Viewer
        </Title>
        <Subtitle
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          Advanced medical imaging viewer with 2D and 3D visualization capabilities.
          Upload ZIP files containing DICOM data to get started.
        </Subtitle>
      </Header>

      <DropzoneContainer
        isDragActive={isDragActive}
        isDragReject={isDragReject}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        onClick={getRootProps().onClick}
        onKeyDown={getRootProps().onKeyDown}
        role={getRootProps().role}
        tabIndex={getRootProps().tabIndex}
      >
        <input {...getInputProps()} />
        <UploadIcon
          animate={{ 
            rotate: isDragActive ? 360 : 0,
            scale: isDragActive ? 1.2 : 1
          }}
          transition={{ duration: 0.3 }}
        >
          📁
        </UploadIcon>
        <UploadText>
          {isDragActive 
            ? 'Drop your ZIP files here' 
            : 'Drag & drop ZIP files here'
          }
        </UploadText>
        <UploadSubtext>
          or click to browse and select files
        </UploadSubtext>
      </DropzoneContainer>

      {selectedFiles.length > 0 && (
        <FileList
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {selectedFiles.map((file, index) => (
            <FileItem
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <FileInfo>
                <FileIcon>📦</FileIcon>
                <FileDetails>
                  <FileName>{file.name}</FileName>
                  <FileSize>{formatFileSize(file.size)}</FileSize>
                </FileDetails>
              </FileInfo>
            </FileItem>
          ))}
        </FileList>
      )}

      {/* Progress Bar - Show when uploading */}
      {state.isLoading && (
        <ProgressContainer
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <ProgressText>
            {state.uploadProgress > 0 
              ? `Uploading files... ${state.uploadProgress}%`
              : 'Preparing upload...'
            }
          </ProgressText>
          <ProgressBar>
            <ProgressFill progress={state.uploadProgress} />
          </ProgressBar>
        </ProgressContainer>
      )}

      {selectedFiles.length > 0 && (
        <UploadButton
          onClick={handleUpload}
          disabled={state.isLoading}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {state.isLoading ? (
            <>
              <LoadingSpinner
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              Processing DICOM files...
            </>
          ) : (
            'Upload & View DICOM Data'
          )}
        </UploadButton>
      )}

      {state.error && (
        <ErrorMessage
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {state.error}
        </ErrorMessage>
      )}
    </Container>
  );
}
