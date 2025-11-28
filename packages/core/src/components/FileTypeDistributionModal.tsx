/**
 * @file packages/core/src/components/FileTypeDistributionModal.tsx
 * @stamp {"ts":"2025-11-28T14:35:00Z"}
 * @architectural-role UI Component
 *
 * @description
 * The primary configuration dashboard for the application. It acts as a controller
 * view, aggregating file index statistics and providing controls to modify the
 * global sanitation configuration (extensions, patterns, and project root).
 *
 * @core-principles
 * 1. IS the central interface for runtime configuration management.
 * 2. ORCHESTRATES the visualization of the current file index statistics.
 * 3. DELEGATES actual state mutations to the global `useSlicerStore`.
 *
 * @api-declaration
 *   export interface FileTypeDistributionModalProps {
 *     open: boolean;
 *     onClose: () => void;
 *   }
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     state_ownership: [tabIndex, localFormState]
 *     external_io: none # Delegates all data persistence to the Store actions.
 */

import React, { useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  List, ListItem, ListItemText, ListItemIcon, Checkbox,
  Collapse, Typography, Chip, Box, Stack, IconButton, Tabs, Tab, TextField, Alert
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';

import { useSlicerStore } from '../state/useSlicerStore';
import { FolderBrowser } from './FolderBrowser'; // Import the new component

interface GroupStats {
  extension: string;
  count: number;
  totalBytes: number;
  files: Array<{ path: string; size: number }>;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export const FileTypeDistributionModal: React.FC<Props> = ({ open, onClose }) => {
  const { fileIndex, slicerConfig, updateConfig, source } = useSlicerStore();
  
  const [tabIndex, setTabIndex] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newPattern, setNewPattern] = useState('');
  
  // Folder Browser State
  const [browserOpen, setBrowserOpen] = useState(false);

  // --- STATS CALCULATION ---
  const stats = useMemo(() => {
    if (!fileIndex) return [];
    const map = new Map<string, GroupStats>();

    fileIndex.forEach((entry) => {
      const ext = entry.path.split('.').pop()?.toLowerCase() || 'no-ext';
      if (!map.has(ext)) {
        map.set(ext, { extension: ext, count: 0, totalBytes: 0, files: [] });
      }
      const group = map.get(ext)!;
      group.count++;
      group.totalBytes += entry.size;
      group.files.push({ path: entry.path, size: entry.size });
    });

    return Array.from(map.values()).sort((a, b) => b.totalBytes - a.totalBytes);
  }, [fileIndex]);

  // --- HANDLERS ---

  const handleToggleExtension = (ext: string) => {
    if (!slicerConfig) return;
    const currentList = slicerConfig.sanitation.acceptedExtensions || [];
    const newSet = new Set(currentList);
    if (newSet.has(ext)) newSet.delete(ext);
    else newSet.add(ext);
    updateConfig({
      ...slicerConfig,
      sanitation: { ...slicerConfig.sanitation, acceptedExtensions: Array.from(newSet) }
    });
  };

  const handleAddPattern = () => {
    if (!newPattern.trim() || !slicerConfig) return;
    updateConfig({
      ...slicerConfig,
      sanitation: {
        ...slicerConfig.sanitation,
        denyPatterns: [...slicerConfig.sanitation.denyPatterns, newPattern.trim()]
      }
    });
    setNewPattern('');
  };

  const handleRemovePattern = (pattern: string) => {
    if (!slicerConfig) return;
    updateConfig({
      ...slicerConfig,
      sanitation: {
        ...slicerConfig.sanitation,
        denyPatterns: slicerConfig.sanitation.denyPatterns.filter(p => p !== pattern)
      }
    });
  };

  const handleRootChange = (newPath: string) => {
    if (!slicerConfig) return;
    
    // We need to calculate the relative path from the CWD (where the executable runs) to the new path.
    // However, the backend config expects 'targetProjectRoot'. 
    // Since we don't know the CWD on the frontend easily, we might need to send an absolute path 
    // if the backend supports it, OR rely on the backend to normalize.
    // Our updated backend config logic uses path.resolve(CWD, target). 
    // If we pass an absolute path, path.resolve ignores the CWD and uses the absolute path.
    // So passing the absolute path from FolderBrowser is strictly correct!
    
    updateConfig({
        ...slicerConfig,
        project: {
            ...slicerConfig.project,
            targetProjectRoot: newPath
        }
    });
    setBrowserOpen(false);
  };

  const activeExtensions = new Set(slicerConfig?.sanitation.acceptedExtensions || []);
  const denyPatterns = slicerConfig?.sanitation.denyPatterns || [];
  const currentRoot = slicerConfig?.project?.targetProjectRoot || '.';

  return (
    <>
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Settings</DialogTitle>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} variant="fullWidth">
          <Tab label="Project" />
          <Tab label="Extensions" />
          <Tab label="Exclusions" />
        </Tabs>
      </Box>

      <DialogContent dividers sx={{ p: 0, height: '400px' }}>
        
        {/* TAB 0: PROJECT ROOT */}
        {tabIndex === 0 && (
            <Box p={3}>
                <Typography variant="h6" gutterBottom>Target Directory</Typography>
                
                {source === 'zip' ? (
                    <Alert severity="info">
                        You are in Zip Mode. The root directory is the root of the zip file.
                    </Alert>
                ) : (
                    <Box>
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Changing this will trigger a full re-scan of the new directory.
                        </Alert>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <TextField 
                                fullWidth 
                                value={currentRoot} 
                                label="Absolute Path"
                                InputProps={{
                                    readOnly: true,
                                    startAdornment: <FolderOpenIcon color="action" sx={{ mr: 1 }} />
                                }}
                            />
                            <Button 
                                variant="contained" 
                                size="large" 
                                startIcon={<EditIcon />}
                                onClick={() => setBrowserOpen(true)}
                            >
                                Change
                            </Button>
                        </Stack>
                    </Box>
                )}

                <Box mt={4}>
                    <Typography variant="h6" gutterBottom>Configuration Source</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Settings are currently saved to: <strong>slicer-config.yaml</strong> in the executable's directory.
                    </Typography>
                </Box>
            </Box>
        )}

        {/* TAB 1: EXTENSIONS */}
        {tabIndex === 1 && (
          <List>
            {stats.map((group) => {
              const isChecked = activeExtensions.has(group.extension);
              const tokenEst = Math.round(group.totalBytes / 4).toLocaleString();
              
              return (
                <React.Fragment key={group.extension}>
                  <ListItem>
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        checked={isChecked}
                        onChange={() => handleToggleExtension(group.extension)}
                      />
                    </ListItemIcon>
                    <ListItemText 
                      primary={
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            .{group.extension}
                          </Typography>
                          <Chip label={`${group.count} files`} size="small" />
                          <Chip label={`~${tokenEst} tokens`} size="small" variant="outlined" />
                        </Stack>
                      }
                    />
                    <IconButton onClick={() => setExpanded(expanded === group.extension ? null : group.extension)}>
                      {expanded === group.extension ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  </ListItem>
                  <Collapse in={expanded === group.extension} timeout="auto" unmountOnExit>
                    <Box sx={{ pl: 9, pr: 2, pb: 2, maxHeight: 200, overflowY: 'auto', bgcolor: 'action.hover' }}>
                      {group.files.map(f => (
                        <Box key={f.path} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{f.path}</Typography>
                          <Typography variant="caption" color="text.secondary">{Math.round(f.size / 4)} toks</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Collapse>
                </React.Fragment>
              );
            })}
          </List>
        )}

        {/* TAB 2: DENY PATTERNS */}
        {tabIndex === 2 && (
          <Box sx={{ p: 2 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <TextField 
                fullWidth 
                size="small" 
                label="Add Exclusion Pattern (glob)" 
                placeholder="e.g., legacy-code/**"
                value={newPattern}
                onChange={e => setNewPattern(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddPattern()}
              />
              <Button variant="contained" onClick={handleAddPattern} startIcon={<AddIcon />}>
                Add
              </Button>
            </Stack>
            
            <List dense sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              {denyPatterns.map((pattern, idx) => (
                <ListItem key={idx} secondaryAction={
                  <IconButton edge="end" onClick={() => handleRemovePattern(pattern)}>
                    <DeleteIcon />
                  </IconButton>
                }>
                  <ListItemText primary={pattern} sx={{ fontFamily: 'monospace' }} />
                </ListItem>
              ))}
              {denyPatterns.length === 0 && (
                <ListItem>
                  <ListItemText secondary="No patterns defined." />
                </ListItem>
              )}
            </List>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>

    <FolderBrowser 
        open={browserOpen} 
        onClose={() => setBrowserOpen(false)} 
        onSelect={handleRootChange}
        initialPath={currentRoot === '.' ? undefined : currentRoot} // Let browser handle defaults if '.'
    />
    </>
  );
};