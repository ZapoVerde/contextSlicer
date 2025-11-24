/**
 * @file packages/web/src/App.tsx
 * @stamp {"ts":"2025-11-24T07:00:00Z"}
 * @architectural-role Application Entry Point
 *
 * @description
 * The root component of the Web implementation. It acts as the composition root,
 * bootstrapping the Core UI and (eventually) injecting the Web-specific data adapter.
 *
 * @core-principles
 * 1. IS the composition root for the Web-based context slicer.
 * 2. ORCHESTRATES the environment setup (Theme, Layout).
 * 3. DELEGATES all feature logic and UI rendering to the `@slicer/core` package.
 *
 * @contract
 *   assertions:
 *     purity: pure # React component.
 *     state_ownership: none # Delegates to global store.
 *     external_io: none # (Pending Adapter injection).
 */

import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
// We import the theme directly to apply it at the root
import { theme } from '@slicer/core/src/theme/theme';
import { ContextSlicerScreen, useSlicerStore } from '@slicer/core';

// TODO: In Phase 2, we will implement and import the ZipAdapter here.
// import { ZipAdapter } from './logic/ZipAdapter'; 

const App: React.FC = () => {
  const { status, error } = useSlicerStore();

  // In the Web version, we don't auto-load on mount.
  // We wait for the user to drop a file (handled by the ContextSlicerScreen internal loader for now).
  
  // This mock loading state prevents premature rendering if we needed to fetch config first.
  const isLoadingConfig = false; 

  if (isLoadingConfig) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading...</Typography>
      </Box>
    );
  }

  if (status === 'error' && error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', p: 4 }}>
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>Application Error</Typography>
          <Typography>{error}</Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ContextSlicerScreen />
    </ThemeProvider>
  );
};

export default App;