/**
 * @file src/App.tsx
 * @stamp {"ts":"2025-10-03T01:25:00Z"}
 * @architectural-role UI Component / Application Root / Configuration Initiator
 *
 * @description
 * This is the root component of the application. Its primary responsibilities are
 * to provide the global theme, trigger the initial loading of the application's
 * external configuration, and act as a gatekeeper for the main UI. It renders a
 * global loading state until the configuration is fetched and a fatal error
 * state if the configuration fails to load, ensuring that the main application
 * screen only mounts when the system is in a valid, configured state.
 *
 * @contract
 * State Ownership: This component is stateless but consumes the global `status`,
 *   `error`, `slicerConfig`, and `loadConfig` from the `useZipStore`.
 * Public API: `App: React.FC`.
 * Core Invariants:
 *   - MUST trigger the `loadConfig` action exactly once on initial mount.
 *   - MUST render a loading indicator while the configuration is being fetched.
 *   - MUST render a fatal error display if the configuration loading fails.
 *   - MUST only render the `ContextSlicerScreen` after the configuration has
 *     been successfully loaded into the state.
 */
import React, { useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, CircularProgress, Alert, Typography } from '@mui/material';
import { theme } from './theme/theme';
import ContextSlicerScreen from './features/context-slicer/ContextSlicerScreen';
import { useZipStore } from './features/context-slicer/state/useZipStore';

const App: React.FC = () => {
  const slicerConfig = useZipStore((state) => state.slicerConfig);
  const status = useZipStore((state) => state.status);
  const error = useZipStore((state) => state.error);
  const loadConfig = useZipStore((state) => state.loadConfig);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  if (!slicerConfig && status !== 'error') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>Loading application configuration...</Typography>
      </Box>
    );
  }

  if (status === 'error' && error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', p: 4 }}>
        <Alert severity="error" sx={{ maxWidth: 600 }}>
          <Typography variant="h6" gutterBottom>Application Error</Typography>
          <Typography>{error}</Typography>
          <Typography sx={{ mt: 2 }}>Please refresh the page or contact support if the issue persists.</Typography>
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