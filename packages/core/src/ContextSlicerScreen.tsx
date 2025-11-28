/**
 * @file packages/core/src/ContextSlicerScreen.tsx
 * @stamp {"ts":"2025-11-24T17:15:00Z"}
 * @architectural-role UI Component / Screen Entry Point
 *
 * @description
 * This component serves as the main visual container for the application.
 * It orchestrates the layout of the high-level panels (Loader, Query Tools,
 * Pack Generator) and handles the responsive framing. It now includes the
 * "File Type Distribution" modal for advanced configuration.
 *
 * @core-principles
 * 1. IS the primary layout container for the feature.
 * 2. ORCHESTRATES the visual hierarchy of the tool's panels.
 * 3. DELEGATES all data loading logic to the `ZipLoader` and `App` entry points.
 *
 * @contract
 *   assertions:
 *     purity: pure # React component.
 *     state_ownership: [modalOpen] # Manages local UI state for the modal.
 *     external_io: none
 */

import React, { useState } from 'react';
import { 
  Box, Paper, Typography, CircularProgress, Stack, IconButton, Backdrop 
} from '@mui/material';
import { 
  ContentCut as ContentCutIcon, 
  GitHub as GitHubIcon, 
  Settings as SettingsIcon 
} from '@mui/icons-material';
import { SourceDumpPanel } from './components/SourceDumpPanel.js';
import { ZipLoader } from './components/ZipLoader.js';
import { FileTypeDistributionModal } from './components/FileTypeDistributionModal.js';
import { useSlicerStore } from './state/useSlicerStore.js';

const ContextSlicerScreen: React.FC = () => {
  // We grab graphStatus to show the spinner during the AST parsing phase too
  const { status, graphStatus } = useSlicerStore();
  const [modalOpen, setModalOpen] = useState(false);

  // Determine if the app is busy doing heavy lifting
  const isScanning = status === 'loading';
  const isBuildingGraph = graphStatus === 'building';
  const isBusy = isScanning || isBuildingGraph;

  const loadingLabel = isScanning 
    ? 'Scanning Filesystem...' 
    : 'Analyzing Dependency Graph...';

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, height: '100%', overflowY: 'auto' }}>
      
      {/* --- GLOBAL BUSY INDICATOR --- */}
      <Backdrop
        sx={{ 
          color: '#fff', 
          zIndex: (theme) => theme.zIndex.drawer + 999,
          flexDirection: 'column',
          gap: 2
        }}
        open={isBusy}
      >
        <CircularProgress color="inherit" size={60} thickness={4} />
        <Typography variant="h6" sx={{ fontWeight: '500', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
          {loadingLabel}
        </Typography>
      </Backdrop>

      <Box sx={{ maxWidth: '1200px', marginX: 'auto', mb: 3 }}>
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

          <Stack direction="row" spacing={1}>
            <IconButton 
              onClick={() => setModalOpen(true)} 
              title="Settings"
              // Allow opening settings even if idle/ready, but maybe disable if busy?
              disabled={isBusy}
            >
              <SettingsIcon />
            </IconButton>

            <IconButton
              component="a"
              href="https://github.com/ZapoVerde/contextSlicer"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View on GitHub"
              sx={{ color: 'text.secondary' }}
            >
              <GitHubIcon sx={{ fontSize: '2rem' }} />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      <Paper elevation={3} sx={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Box p={2} pb={status === 'ready' ? 0 : 2}>
          <ZipLoader />
        </Box>

        {/* 
           We remove the old inline loader logic here because the Backdrop 
           now handles the visual feedback for 'loading'.
           We only show the "Intro Text" if we are truly Idle (start up).
        */}
        {(status === 'idle') && (
          <Box sx={{ p: 4, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ 
              mb: 3, 
              textAlign: 'left', 
              maxWidth: '80ch', 
              mx: 'auto',
              p: 2, 
              backgroundColor: 'background.paper', 
              borderRadius: 1 
            }}>
              <Typography variant="h6" gutterBottom>
                For developers using LLMs on large JS/TS codebases.
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                When your project grows beyond a few dozen files, providing context to an AI becomes a bottleneck. Pasting your whole repo is impossible. Manually hunting down every relevant file for a single task is slow and error-prone.
              </Typography>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Context Slicer automates that hunt.
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                It's a specialized tool that creates token-efficient "context packs" by understanding your code's structure. Its core feature is <strong>dependency-aware tracing</strong>.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Drag and drop a `.zip` of your repository above (or connect to the Desktop Tool) to begin.
              </Typography>
            </Box>
            <img 
              src="/context-slicer-demo.gif" 
              alt="Context Slicer Demo" 
              style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #444', marginBottom: '16px' }} 
            />
          </Box>
        )}

        {status === 'ready' && <SourceDumpPanel />}
      </Paper>

      <FileTypeDistributionModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
      />
    </Box>
  );
};

export default ContextSlicerScreen;