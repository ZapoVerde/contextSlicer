/**
 * @file src/features/sourceDump/SourceDumpScreen.tsx
 * @architectural-role UI Component / Screen Entry Point / Environment Gatekeeper
 *
 * @description This component serves as the main entry point and container for the
 * entire Source Dump feature. It is responsible for orchestrating the initial data
 * loading sequence and rendering the appropriate UI based on the current state.
 *
 * It also acts as the **environment gatekeeper** for the feature. It uses Vite's
 * environment variables to ensure that the development-specific logic (like
 * automatically loading from the dev server) is completely disabled and removed
 * from the production build.
 *
 * @responsibilities
 * 1.  **Initial Data Fetch (Dev Only):** Utilizes a `useEffect` hook that, only in a
 *     development environment (`import.meta.env.DEV`), triggers the `loadFromDevServer`
 *     action in the `useZipStore` when the component first mounts.
 * 2.  **State-Driven Rendering:** Subscribes to the `status` from `useZipStore` to
 *     conditionally render the UI, showing a loading spinner or the main panel.
 * 3.  **Layout & Structure:** Provides the overall page structure, including padding,
 *     the page title, and the main `Paper` container.
 */
import React, { useEffect } from 'react';
// --- START OF CHANGE: Import IconButton and the GitHubIcon ---
import { Box, Paper, Typography, CircularProgress, Stack, IconButton } from '@mui/material';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import GitHubIcon from '@mui/icons-material/GitHub';
// --- END OF CHANGE ---
import { SourceDumpPanel } from './components/SourceDumpPanel';
import { ZipLoader } from './components/ZipLoader';
import { useZipStore } from './state/useZipStore';

const SourceDumpScreen: React.FC = () => {
  const { status, loadFromDevServer } = useZipStore();

  useEffect(() => {
    if (import.meta.env.DEV) {
      loadFromDevServer();
    }
  }, [loadFromDevServer]);

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, height: '100%', overflowY: 'auto' }}>
      <Box sx={{ maxWidth: '1200px', marginX: 'auto', mb: 3 }}>
        {/* --- START OF CHANGE: Add a parent Stack for alignment --- */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <ContentCutIcon color="primary" sx={{ fontSize: '2.5rem' }} />
            <Box>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                Context Slicer
              </Typography>
              <Typography variant="body1" color="text.secondary">
                An open source tool for creating targeted context packs from TypeScript/JS projects.
              </Typography>
            </Box>
          </Stack>

          <IconButton
            component="a"
            href="https://github.com/ZapoVerde/contextSlicer" // <-- REPLACE WITH YOUR REPO URL
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View on GitHub"
            sx={{ color: 'text.secondary' }}
          >
            <GitHubIcon sx={{ fontSize: '2rem' }} />
          </IconButton>
        </Stack>
        {/* --- END OF CHANGE --- */}
      </Box>

      <Paper elevation={3} sx={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Box p={2} pb={status === 'ready' ? 0 : 2}>
          <ZipLoader />
        </Box>

        {(status === 'loading' || status === 'idle') && (
          <Box sx={{ p: 4, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
            {status === 'loading' ? (
              <>
                <CircularProgress />
                <Typography sx={{ mt: 2 }}>Attempting to load from dev server...</Typography>
              </>
            ) : (
              <>
                <Typography variant="h6" gutterBottom>
                  How it Works
                </Typography>
                <img 
                  src="/context-slicer-demo.gif" 
                  alt="Context Slicer Demo" 
                  style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #444', marginBottom: '16px' }} 
                />
                <Typography variant="body2" color="text.secondary">
                  Drop a .zip file of a repository onto the panel above to begin.
                </Typography>
              </>
            )}
          </Box>
        )}

        {status === 'ready' && <SourceDumpPanel />}
      </Paper>
    </Box>
  );
};

export default SourceDumpScreen;