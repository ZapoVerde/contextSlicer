/**
 * @file packages/desktop/client/App.tsx
 * @stamp 2025-11-24T13:10:00Z
 * @architectural-role Application Entry Point
 *
 * @description
 * The root component for the Desktop application.
 * It initializes the ApiFileSource and injects it into the Core Store immediately.
 *
 * @core-principles
 * 1. IS the composition root for the Desktop context.
 * 2. AUTOMATICALLY connects to the local server on mount.
 *
 * @contract
 *   assertions:
 *     purity: pure # React component.
 */

import React, { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { theme } from '@slicer/core';
import { ContextSlicerScreen, useSlicerStore } from '@slicer/core';
import { ApiFileSource } from './logic/adapters/apiFileSource.js';

const App: React.FC = () => {
  const { setFileSource } = useSlicerStore();

  useEffect(() => {
    // Initialize connection to the local server immediately
    const adapter = new ApiFileSource();
    setFileSource(adapter, 'api');
  }, [setFileSource]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ContextSlicerScreen />
    </ThemeProvider>
  );
};

export default App;