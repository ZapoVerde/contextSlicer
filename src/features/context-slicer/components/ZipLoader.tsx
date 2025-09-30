/**
 * @file packages/context-slicer-app/src/features/context-slicer/components/ZipLoader.tsx
 * @stamp {"ts":"2025-09-29T05:27:00Z"}
 * @architectural-role UI Component / Status & Control Panel / Drop Zone
 *
 * @description
 * This component serves as the primary control panel and status indicator for the
 * Context Slicer application. It is always visible, providing the user with a
 * consistent way to load source code and understand its global health.
 *
 * It acts as the "Source Code Health Report," displaying the current load status
 * (e.g., "Live Dev Server," "Uploaded ZIP"), data freshness, a summary of the
 * client-side sanitation process, and a report of any invalid import paths
 * discovered during dependency analysis. It also serves as the primary drop zone
 * for users to upload a `.zip` file of a repository.
 *
 * @contract
 * State Ownership: This component owns local, transient UI state for the drag-over
 *   effect (`isDraggingOver`) and the open/close state of its two collapsible
 *   detail panels (`sanitationDetailsOpen`, `errorDetailsOpen`). It consumes all
 *   application-level state (e.g., `status`, `error`, reports) from `useZipStore`.
 * Public API: This component has no props (`React.FC`).
 * Core Invariants:
 *   - MUST accurately reflect the global application state (`status`, `source`, `isStale`).
 *   - MUST provide UI controls for loading a zip file and, in dev mode, refreshing.
 *   - MUST act as a drag-and-drop zone for `.zip` files.
 *   - MUST conditionally render the sanitation and path resolution error reports
 *     when the corresponding data is available and non-empty.
 *   - MUST correctly manage the visibility of its collapsible detail panels.
 */

import React, { useRef, useCallback, useState } from 'react';
import {
  Paper, Typography, Button, Alert, Stack, Box, useTheme, alpha, Link, Collapse, List, ListItem, ListItemText
} from '@mui/material';
import { useZipStore } from '../state/useZipStore';
import { useFreshnessStatus } from '../hooks/useFreshnessStatus';
import type { SkippedFile } from '../state/zip-state';


// --- Helper Functions & Local Components ---

function formatRelativeTime(date: Date | null): string {
  if (!date) return '';
  const now = new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

const SanitationDetails: React.FC<{ skippedFiles: SkippedFile[] }> = ({ skippedFiles }) => {
  const grouped = skippedFiles.reduce((acc, file) => {
    if (!acc[file.reason]) acc[file.reason] = [];
    acc[file.reason].push(file.path);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <Box sx={{ maxHeight: 200, overflowY: 'auto', mt: 1, backgroundColor: 'action.hover', p: 1, borderRadius: 1 }}>
      <List dense disablePadding>
        {Object.entries(grouped).map(([reason, paths]) => (
          <React.Fragment key={reason}>
            <ListItem sx={{ pt: 0, pb: 0 }}>
              <ListItemText primary={`Skipped due to: ${reason}`} primaryTypographyProps={{ fontWeight: 'bold', variant: 'caption' }} />
            </ListItem>
            {paths.map(path => (
              <ListItem key={path} sx={{ pl: 4, pt: 0, pb: 0 }}>
                <ListItemText primary={path} primaryTypographyProps={{ variant: 'caption' }} />
              </ListItem>
            ))}
          </React.Fragment>
        ))}
      </List>
    </Box>
  );
};

const ResolutionErrorDetails: React.FC<{ errors: string[] }> = ({ errors }) => (
  <Box sx={{ maxHeight: 200, overflowY: 'auto', mt: 1, backgroundColor: 'action.hover', p: 1, borderRadius: 1 }}>
    <List dense disablePadding>
      {errors.map((error, index) => (
        <ListItem key={index}>
          <ListItemText 
            primary={error} 
            primaryTypographyProps={{ variant: 'caption', sx: { fontFamily: 'monospace' } }} 
          />
        </ListItem>
      ))}
    </List>
  </Box>
);


// --- Main Component ---

export const ZipLoader: React.FC = () => {
  const { status, error, loadZipFile, reset, sanitationReport, resolutionErrors } = useZipStore();
  const { isStale, showTimestamps, generatedAt, lastSave, source } = useFreshnessStatus();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [sanitationDetailsOpen, setSanitationDetailsOpen] = useState(false);
  const [errorDetailsOpen, setErrorDetailsOpen] = useState(false);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) { loadZipFile(file); }
    if (event.target) { event.target.value = ''; }
  }, [loadZipFile]);

  const handleLoadZipClick = () => fileInputRef.current?.click();
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); }, []);
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.zip')) { loadZipFile(file); }
    else { alert('Please drop a single .zip file.'); }
  }, [loadZipFile]);

  const isReady = status === 'ready';
  let alertSeverity: 'success' | 'info' | 'error' | 'warning' = 'info';
  let alertMessage = 'No source loaded. Drop a zip file or click "Load Zip File".';
  if (status === 'error') { alertSeverity = 'error'; alertMessage = `Error: ${error}`; }
  else if (isReady) {
    alertSeverity = source === 'zip' || !isStale ? 'success' : 'warning';
    alertMessage = source === 'zip' ? 'Source loaded from: Uploaded ZIP File' : isStale ? 'Source is Stale (Rebuilding...)' : 'Source loaded from: Live Dev Server';
  }

  return (
    <Paper
      variant="outlined"
      sx={{ mb: 2, transition: 'background-color 0.2s, border-color 0.2s', ...(isDraggingOver && { borderColor: 'primary.main', backgroundColor: alpha(theme.palette.primary.main, 0.1), }), }}
      onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".zip" style={{ display: 'none' }} />
      {isDraggingOver ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, p: 2 }}>
          <Typography variant="h6" color="primary.main">Drop ZIP file to load</Typography>
        </Box>
      ) : (
        <>
          <Box p={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <Box sx={{ flexGrow: 1, width: '100%' }}>
                <Alert severity={alertSeverity} sx={{ p: '0 16px', '& .MuiAlert-icon': { p: '7px 0' } }}>
                  <Typography variant="body1" component="div"><strong>{alertMessage}</strong></Typography>
                  
                  {showTimestamps && (
                    <Typography variant="caption" component="div" sx={{ mt: 0.5, lineHeight: 1.2 }}>
                      {lastSave && <>Last File Save: {lastSave.toLocaleTimeString()} ({formatRelativeTime(lastSave)})<br /></>}
                      {generatedAt && <>Source Dump Generated: {generatedAt.toLocaleTimeString()} ({formatRelativeTime(generatedAt)})</>}
                    </Typography>
                  )}

                  {sanitationReport && sanitationReport.skippedCount > 0 && (
                    <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                      {`Processed ${sanitationReport.processedCount} files. Skipped ${sanitationReport.skippedCount} files. `}
                      <Link component="button" variant="caption" onClick={() => setSanitationDetailsOpen(!sanitationDetailsOpen)}>
                        {sanitationDetailsOpen ? 'Hide Details' : 'Show Details'}
                      </Link>
                    </Typography>
                  )}
                  
                  {resolutionErrors && resolutionErrors.length > 0 && (
                    <Typography variant="caption" component="div" sx={{ color: 'error.main', mt: 0.5 }}>
                      🔴 Found {resolutionErrors.length} invalid import(s).{' '}
                      <Link component="button" variant="caption" onClick={() => setErrorDetailsOpen(!errorDetailsOpen)}>
                        {errorDetailsOpen ? 'Hide Details' : 'Show Details'}
                      </Link>
                    </Typography>
                  )}
                </Alert>
              </Box>
              <Stack direction="row" spacing={2} alignItems="center">
                <Stack direction="column" spacing={1}>
                  {import.meta.env.DEV && (
                    <Button fullWidth variant="outlined" size="small" onClick={reset}>Refresh Dev</Button>
                  )}
                  <Button fullWidth variant={isReady && import.meta.env.DEV ? 'outlined' : 'contained'} size="small" onClick={handleLoadZipClick}>
                    {isReady && import.meta.env.DEV ? 'Override with Zip' : 'Load Zip File'}
                  </Button>
                </Stack>
                <Stack direction="column" spacing={0.5} sx={{ textAlign: 'left' }}>
                  <Link href="./docs/cheatsheet.md" target="_blank" rel="noopener noreferrer" variant="body2">Quick-Start Cheatsheet</Link>
                  <Link href="./docs/Feature_Guide.md" target="_blank" rel="noopener noreferrer" variant="body2">Full Feature Guide</Link>
                </Stack>
              </Stack>
            </Stack>
          </Box>
          
          <Collapse in={sanitationDetailsOpen} sx={{ px: 2, pb: sanitationDetailsOpen ? 2 : 0 }}>
            {sanitationReport && <SanitationDetails skippedFiles={sanitationReport.skippedFiles} />}
          </Collapse>
          
          <Collapse in={errorDetailsOpen} sx={{ px: 2, pb: errorDetailsOpen ? 2 : 0 }}>
            {resolutionErrors && <ResolutionErrorDetails errors={resolutionErrors} />}
          </Collapse>
        </>
      )}
    </Paper>
  );
};