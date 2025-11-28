/**
 * @file packages/core/src/components/ZipLoader.tsx
 * @stamp 2025-11-24T11:10:00Z
 * @architectural-role UI Component
 * @description
 * The universal input component. It displays the current status (Live vs Zip)
 * and accepts file drops to switch the application into "Zip Mode".
 */

import React, { useRef, useCallback, useState } from 'react';
import {
  Paper, Typography, Button, Alert, Stack, Box, useTheme, alpha
} from '@mui/material';
import { useSlicerStore } from '../state/useSlicerStore';
import { ZipFileSource } from '../logic/adapters/zipFileSource';

export const ZipLoader: React.FC = () => {
  const { status, source, error, setFileSource, reset } = useSlicerStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleLoadZip = useCallback((file: File) => {
    const adapter = new ZipFileSource(file);
    setFileSource(adapter, 'zip');
  }, [setFileSource]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) handleLoadZip(file);
    if (event.target) event.target.value = '';
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.zip')) {
      handleLoadZip(file);
    } else {
      alert('Please drop a single .zip file.');
    }
  }, [handleLoadZip]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => setIsDraggingOver(false);

  // UI Logic
  const isReady = status === 'ready';
  let alertSeverity: 'success' | 'info' | 'error' | 'warning' = 'info';
  let alertMessage = 'No source loaded. Drop a zip file or click "Load Zip".';

  if (status === 'error') {
    alertSeverity = 'error';
    alertMessage = `Error: ${error}`;
  } else if (isReady) {
    if (source === 'api') {
      alertSeverity = 'success';
      alertMessage = 'Connected to Live Desktop Server';
    } else {
      alertSeverity = 'success';
      alertMessage = 'Loaded from Zip File';
    }
  }

  return (
    <Paper
      variant="outlined"
      sx={{ 
        mb: 2, 
        transition: 'background-color 0.2s, border-color 0.2s', 
        ...(isDraggingOver && { 
          borderColor: 'primary.main', 
          backgroundColor: alpha(theme.palette.primary.main, 0.1), 
        }), 
      }}
      onDragEnter={handleDragOver} 
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave} 
      onDrop={handleDrop}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".zip" style={{ display: 'none' }} />
      
      {isDraggingOver ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 80, p: 2 }}>
          <Typography variant="h6" color="primary.main">Drop ZIP file to load</Typography>
        </Box>
      ) : (
        <Box p={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
            <Box sx={{ flexGrow: 1, width: '100%' }}>
              <Alert severity={alertSeverity} sx={{ p: '0 16px' }}>
                <Typography variant="body2"><strong>{alertMessage}</strong></Typography>
              </Alert>
            </Box>
            
            <Stack direction="row" spacing={1}>
              {source === 'zip' && (
                <Button variant="outlined" size="small" onClick={reset}>
                  Clear
                </Button>
              )}
              <Button 
                variant={source === 'none' ? 'contained' : 'outlined'} 
                size="small" 
                onClick={() => fileInputRef.current?.click()}
              >
                Load Zip
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
    </Paper>
  );
};