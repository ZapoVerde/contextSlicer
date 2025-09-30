/**
 * @file src/features/context-slicer/components/DocsFolderPanel.tsx
 * @architectural-role UI Component / Presentational (Dumb)
 */

import React from 'react';
import {
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Tooltip,
  Stack,
  IconButton,
  // --- START OF CHANGE (1/1): Import theme utilities ---
  useTheme,
  alpha,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
// --- START OF CHANGE (1/1): Import new icon ---
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

const HELP_TEXT_DOCS =
  'Convenience shortcuts. Select top-level folders from your `docs/` directory to automatically include all of their files in the context pack.';

interface DocsFolderPanelProps {
  folders: string[];
  checkedFolders: Record<string, boolean>;
  onToggleFolder: (folderName: string) => void;
  disabled: boolean;
}

export const DocsFolderPanel: React.FC<DocsFolderPanelProps> = ({
  folders,
  checkedFolders,
  onToggleFolder,
  disabled,
}) => {
  // --- START OF CHANGE (1/1): Add theme and panel styles ---
  const theme = useTheme();
  const panelStyles = {
    border: '1px solid',
    borderColor: 'divider',
    p: 2,
    mt: 2,
    borderRadius: 1,
    backgroundColor: alpha(theme.palette.success.main, 0.05),
  };

  return (
    // --- START OF CHANGE (1/1): Apply new styles ---
    <Box component="fieldset" sx={panelStyles}>
      <Stack component="legend" direction="row" alignItems="center" spacing={1} sx={{ p: 0, width: 'auto' }}>
        <AddCircleOutlineIcon color="success" />
        <Typography variant="subtitle1" sx={{ mb: 0 }}>
          Include Docs Folders
        </Typography>
        <Tooltip title={HELP_TEXT_DOCS}>
          <IconButton size="small">
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <FormGroup row sx={{ mt: 1 }}>
        {folders.map(folderName => (
          <FormControlLabel
            key={folderName}
            control={
              <Checkbox
                checked={checkedFolders[folderName] || false}
                onChange={() => onToggleFolder(folderName)}
                disabled={disabled}
                size="small"
              />
            }
            label={<Typography variant="body2">{folderName}</Typography>}
          />
        ))}
      </FormGroup>
    </Box>
  );
};