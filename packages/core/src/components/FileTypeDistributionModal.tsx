/**
 * @file packages/core/src/components/FileTypeDistributionModal.tsx
 * @stamp 2025-11-28T13:10:00Z
 * @architectural-role UI Component
 * @description
 * A modal that allows the user to inspect file statistics and modify the
 * active sanitation configuration (Extensions and Deny Patterns).
 * In Web Mode, these changes are volatile (session only).
 */

import React, { useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  List, ListItem, ListItemText, ListItemIcon, Checkbox,
  Collapse, Typography, Chip, Box, Stack, IconButton, Tabs, Tab, TextField, InputAdornment
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useSlicerStore } from '../state/useSlicerStore';

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
  const fileIndex = useSlicerStore(state => state.fileIndex);
  const slicerConfig = useSlicerStore(state => state.slicerConfig);
  const updateConfig = useSlicerStore(state => state.updateConfig);
  
  const [tabIndex, setTabIndex] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newPattern, setNewPattern] = useState('');

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

  const activeExtensions = new Set(slicerConfig?.sanitation.acceptedExtensions || []);
  const denyPatterns = slicerConfig?.sanitation.denyPatterns || [];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Session Configuration
      </DialogTitle>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} variant="fullWidth">
          <Tab label="File Extensions" />
          <Tab label="Exclusion Rules" />
        </Tabs>
      </Box>

      <DialogContent dividers sx={{ p: 0, height: '400px' }}>
        {/* TAB 0: EXTENSIONS */}
        {tabIndex === 0 && (
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

        {/* TAB 1: DENY PATTERNS */}
        {tabIndex === 1 && (
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
            
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Files matching these patterns are completely removed from the index.
            </Typography>

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
  );
};