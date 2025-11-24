/**
 * @file packages/core/src/components/WildcardSearchPanel.tsx
 * @architectural-role UI Component / Presentational
 *
 * @description This component renders the user interface for the "Wildcard Search"
 * feature. It is a "dumb" component that receives all its state and event handlers
 * as props from its parent.
 */
import React from 'react';
import {
  Stack,
  Typography,
  TextField,
  Tooltip,
  IconButton,
  Box,
  useTheme, // Import useTheme to access palette colors
  alpha, // Import alpha for transparent tints
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';

const HELP_TEXT_WILDCARD =
  'Enter comma-separated paths. Wildcards supported: * for single directory, ** for recursive.';

interface WildcardSearchPanelProps {
  wildcardQuery: string;
  setWildcardQuery: (value: string) => void;
  disabled: boolean;
  // --- START OF CHANGE (1/1): Add intent prop ---
  intent?: 'inclusion' | 'exclusion';
}

export const WildcardSearchPanel: React.FC<WildcardSearchPanelProps> = ({
  wildcardQuery,
  setWildcardQuery,
  disabled,
  // --- START OF CHANGE (1/1): Set default intent ---
  intent = 'inclusion',
}) => {
  // --- START OF CHANGE (1/1): Add theme and conditional styles ---
  const theme = useTheme();
  const isInclusion = intent === 'inclusion';

  const icon = isInclusion ? (
    <AddCircleOutlineIcon color="success" />
  ) : (
    <RemoveCircleOutlineIcon color="error" />
  );
  
  const title = isInclusion ? 'Inclusion Patterns' : 'Exclusion Patterns';
  
  const panelStyles = {
    border: '1px solid',
    borderColor: 'divider',
    p: 2,
    mt: 2,
    borderRadius: 1,
    backgroundColor: alpha(
      isInclusion ? theme.palette.success.main : theme.palette.error.main,
      0.05
    ),
  };
  
  return (
    // --- START OF CHANGE (1/1): Apply new styles ---
    <Box component="fieldset" sx={panelStyles}>
      <Stack component="legend" direction="row" alignItems="center" spacing={1} sx={{ p: 0, width: 'auto' }}>
        {icon}
        <Typography variant="subtitle1" sx={{ mb: 0 }}>
          {title}
        </Typography>
        <Tooltip title={HELP_TEXT_WILDCARD}>
          <IconButton size="small">
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <TextField
        label="File paths and patterns (comma-separated)"
        placeholder="src/features/game/logic/**/*, src/utils/*.ts"
        value={wildcardQuery}
        onChange={e => setWildcardQuery(e.target.value)}
        multiline
        minRows={2}
        disabled={disabled}
        fullWidth
        sx={{ mt: 1 }}
      />
    </Box>
  );
};