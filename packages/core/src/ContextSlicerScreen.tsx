/**
 * @file packages/core/src/ContextSlicerScreen.tsx
 * @stamp {"ts":"2025-11-24T11:30:00Z"}
 * @architectural-role UI Component / Screen Entry Point
 *
 * @description
 * This component serves as the main visual container for the application.
 * It orchestrates the layout of the high-level panels (Loader, Query Tools,
 * Pack Generator) and handles the responsive framing.
 *
 * @core-principles
 * 1. IS the primary layout container for the feature.
 * 2. ORCHESTRATES the visual hierarchy of the tool's panels.
 * 3. DELEGATES all data loading logic to the `ZipLoader` and `App` entry points.
 *
 * @contract
 *   assertions:
 *     purity: pure # React component.
 *     state_ownership: none # Consumes global store status.
 *     external_io: none
 */

import React from 'react';
import { Box, Paper, Typography, CircularProgress, Stack, IconButton } from '@mui/material';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import GitHubIcon from '@mui/icons-material/GitHub';
import { SourceDumpPanel } from './components/SourceDumpPanel';
import { ZipLoader } from './components/ZipLoader';
import { useSlicerStore } from './state/useSlicerStore';

const SourceDumpScreen: React.FC = () => {
  const { status } = useSlicerStore();

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, height: '100%', overflowY: 'auto' }}>
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
                <Typography sx={{ mt: 2 }}>Parsing Source Code...</Typography>
              </>
            ) : (
              <>
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