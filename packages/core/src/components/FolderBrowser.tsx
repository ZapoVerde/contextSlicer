/**
 * @file packages/core/src/components/FolderBrowser.tsx
 * @stamp {"ts":"2025-11-28T14:30:00Z"}
 * @architectural-role UI Component
 *
 * @description
 * A modal dialog that provides a visual interface for navigating the host machine's
 * filesystem. It consumes the backend browsing API to allow the user to traverse
 * directories and select a project root.
 *
 * @core-principles
 * 1. IS a specialized UI for hierarchical data traversal.
 * 2. DELEGATES path resolution and security checks to the `/api/fs/browse` endpoint.
 * 3. OWNS the transient state of the current navigation session.
 *
 * @api-declaration
 *   export interface FolderBrowserProps {
 *     open: boolean;
 *     onClose: () => void;
 *     onSelect: (path: string) => void;
 *     initialPath?: string;
 *   }
 *
 * @contract
 *   assertions:
 *     purity: pure # React component with internal state.
 *     state_ownership: [currentPath, directoryData]
 *     external_io: http # Fetches directory contents from the backend API.
 */

import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Box, CircularProgress, Alert, Chip
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface FileSystemNode {
  current: string;
  parent: string;
  folders: string[];
  isProjectRoot: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export const FolderBrowser: React.FC<Props> = ({ open, onClose, onSelect, initialPath }) => {
  const [currentPath, setCurrentPath] = useState(initialPath || '.');
  const [data, setData] = useState<FileSystemNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPath = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      // We assume /api is proxied correctly in both dev and prod
      const res = await fetch(`/api/fs/browse?path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error('Failed to load directory');
      const json = await res.json();
      setData(json);
      setCurrentPath(json.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchPath(currentPath);
  }, [open]);

  const handleNavigate = (folderName: string) => {
    if (!data) return;
    
    // Basic path joining logic (backend handles normalization)
    const separator = data.current.includes('\\') ? '\\' : '/';
    const newPath = data.current.endsWith(separator) 
      ? `${data.current}${folderName}` 
      : `${data.current}${separator}${folderName}`;
    fetchPath(newPath);
  };

  const handleUp = () => {
    if (data?.parent) fetchPath(data.parent);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FolderIcon color="primary" />
          <Typography variant="h6">Select Project Root</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {currentPath}
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ height: '400px', p: 0 }}>
        {loading && <Box p={4} textAlign="center"><CircularProgress /></Box>}
        
        {error && (
          <Box p={2}>
            <Alert severity="error">
              {error}
              <Button size="small" onClick={() => fetchPath('.')}>Reset to App Root</Button>
            </Alert>
          </Box>
        )}

        {!loading && data && (
          <List dense>
            <ListItem disablePadding>
                <ListItemButton 
                    onClick={handleUp} 
                    disabled={data.current === data.parent}
                    sx={{ backgroundColor: 'action.hover' }}
                >
                    <ListItemIcon><ArrowUpwardIcon /></ListItemIcon>
                    <ListItemText primary=".." secondary="Go Up" />
                </ListItemButton>
            </ListItem>
            
            {data.folders.map((folder) => (
              <ListItem key={folder} disablePadding>
                <ListItemButton onClick={() => handleNavigate(folder)}>
                    <ListItemIcon>
                    <FolderIcon color="action" />
                    </ListItemIcon>
                    <ListItemText primary={folder} />
                </ListItemButton>
              </ListItem>
            ))}
            
            {data.folders.length === 0 && (
                <Box p={4} textAlign="center" color="text.secondary">
                    <Typography>Empty Directory</Typography>
                </Box>
            )}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {data?.isProjectRoot && (
                <Chip icon={<CheckCircleIcon />} label="package.json found" color="success" size="small" variant="outlined" />
            )}
        </Box>
        <Box>
            <Button onClick={onClose} color="inherit">Cancel</Button>
            <Button variant="contained" onClick={() => onSelect(currentPath)}>
            Select This Folder
            </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};