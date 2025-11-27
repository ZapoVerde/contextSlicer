/**
 * @file packages/core/src/components/FileTypeDistributionModal.tsx
 * @stamp 2025-11-24T17:00:00Z
 * @architectural-role UI Component
 * @description
 * A modal that analyzes the file index, groups files by extension, calculates token usage,
 * and allows the user to toggle inclusion of specific file types via the config.
 *
 * @core-principles
 * 1. IS the "Control Panel" for the file extension whitelist.
 * 2. AGGREGATES statistics from the current `fileIndex`.
 * 3. MUTATES the global `slicerConfig` via the `updateConfig` action.
 *
 * @contract
 *   assertions:
 *     purity: pure # React component.
 *     state_ownership: none # Delegates to global store.
 *     external_io: none
 */

import React, { useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  List, ListItem, ListItemText, ListItemIcon, Checkbox,
  Collapse, Typography, Chip, Box, Stack, IconButton
} from '@mui/material';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
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
  
  const [expanded, setExpanded] = useState<string | null>(null);

  // 1. Group files by extension
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

  // 2. Handle Toggling
  // Note: In desktop mode without a config, this might be undefined or partial.
  const acceptedExtensions = new Set(slicerConfig?.sanitation.acceptedExtensions || []);

  const handleToggle = (ext: string) => {
    if (!slicerConfig) return;
    
    const newSet = new Set(acceptedExtensions);
    if (newSet.has(ext)) {
      newSet.delete(ext);
    } else {
      newSet.add(ext);
    }

    // Create immutable copy of config
    updateConfig({
      ...slicerConfig,
      sanitation: {
        ...slicerConfig.sanitation,
        acceptedExtensions: Array.from(newSet)
      }
    });
  };

  const handleExpand = (ext: string) => {
    setExpanded(expanded === ext ? null : ext);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>File Type Distribution & Filters</DialogTitle>
      <DialogContent dividers>
        <List>
          {stats.map((group) => {
            const isChecked = acceptedExtensions.has(group.extension);
            const tokenEst = Math.round(group.totalBytes / 4).toLocaleString();
            
            return (
              <React.Fragment key={group.extension}>
                <ListItem>
                  <ListItemIcon>
                    <Checkbox
                      edge="start"
                      checked={isChecked}
                      tabIndex={-1}
                      disableRipple
                      onChange={() => handleToggle(group.extension)}
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
                  <IconButton onClick={() => handleExpand(group.extension)}>
                    {expanded === group.extension ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </ListItem>
                
                <Collapse in={expanded === group.extension} timeout="auto" unmountOnExit>
                  <Box sx={{ pl: 9, pr: 2, pb: 2, maxHeight: 200, overflowY: 'auto', bgcolor: 'action.hover' }}>
                    {group.files.map(f => (
                      <Box key={f.path} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                          {f.path}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {Math.round(f.size / 4)} toks
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Collapse>
              </React.Fragment>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};