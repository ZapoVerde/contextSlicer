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
                <Box sx={{ mb: 2, textAlign: 'center', maxWidth: '80ch', mx: 'auto' }}>
                  <Typography variant="h6" gutterBottom>
                    For developers using LLMs on large JS/TS codebases.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    When your project grows beyond a few dozen files, providing context to an AI becomes a bottleneck. Pasting your whole repo is impossible. Manually hunting down every relevant file for a single task—a component, its store, its types, the services it calls—is slow, error-prone, and kills your workflow. You miss one file, and the AI's response is useless.
                  </Typography>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Context Slicer automates that hunt.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    It's a specialized tool that creates token-efficient "context packs" by understanding your code's structure. Its core feature is <strong>dependency-aware tracing</strong>. Give it a starting point, and it spiders through your import graph to find every file it touches, and every file that touches it.
                  </Typography>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                    Stop curating context by hand. Start slicing it intelligently.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Drag and drop a `.zip` of your repository onto the panel below to see it in action.
                  </Typography>
                </Box>
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