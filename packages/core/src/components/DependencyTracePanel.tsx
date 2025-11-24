/**
 * @file packages/core/src/components/DependencyTracePanel.tsx
 * @architectural-role UI Component / Presentational
 *
 * @description This component renders the user interface for the "Dependency Trace"
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
  Autocomplete,
  Box,
  useTheme,
  alpha,
  // --- START OF CHANGE (1/1): Remove unused MUI components ---
  // FormControl,
  // FormLabel,
  // RadioGroup,
  // FormControlLabel,
  // Radio,
  // Slider,
  // --- END OF CHANGE (1/1) ---
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
// --- START OF CHANGE (1/1): Remove unused type ---
// import type { TraceDirection } from './hooks/useQueryPanelState';
// --- END OF CHANGE (1/1) ---

const HELP_TEXT_TRACE =
  'Start typing a file path or symbol name. The tracer will find related files based on code dependencies.';

interface DependencyTracePanelProps {
  traceQuery: string | null;
  setTraceQuery: (value: string | null) => void;
  // --- START OF CHANGE (1/1): Remove props that are no longer used here ---
  // traceDirection: TraceDirection;
  // setTraceDirection: (value: TraceDirection) => void;
  // traceDepth: number;
  // setTraceDepth: (value: number) => void;
  // --- END OF CHANGE (1/1) ---
  symbolOptions: readonly string[];
  disabled: boolean;
}

export const DependencyTracePanel: React.FC<DependencyTracePanelProps> = ({
  traceQuery,
  setTraceQuery,
  // --- START OF CHANGE (1/1): Remove props ---
  // traceDirection,
  // setTraceDirection,
  // traceDepth,
  // setTraceDepth,
  // --- END OF CHANGE (1/1) ---
  symbolOptions,
  disabled,
}) => {
  const theme = useTheme();
  const panelStyles = {
    border: '1px solid',
    borderColor: 'divider',
    p: 2,
    borderRadius: 1,
    backgroundColor: alpha(theme.palette.success.main, 0.05),
    mt: 2, // Added margin top for spacing
  };

  return (
    <Box component="fieldset" sx={panelStyles}>
      <Stack component="legend" direction="row" alignItems="center" spacing={1} sx={{ p: 0, width: 'auto' }}>
        <AddCircleOutlineIcon color="success" />
        <Typography variant="subtitle1" sx={{ mb: 0 }}>
          Seed: Dependency Trace
        </Typography>
        <Tooltip title={HELP_TEXT_TRACE}>
          <IconButton size="small">
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack spacing={2} sx={{ mt: 1 }}>
        <Autocomplete
          size="small"
          options={symbolOptions}
          value={traceQuery}
          onChange={(_, newValue) => setTraceQuery(newValue)}
          disabled={disabled}
          renderInput={params => <TextField {...params} label="Start Path or Symbol" />}
        />
        {/* --- START OF CHANGE (1/1): Remove the entire Stack containing the slider and radio buttons --- */}
        {/* The Stack with FormControl and Slider has been removed. */}
        {/* --- END OF CHANGE (1/1) --- */}
      </Stack>
    </Box>
  );
};