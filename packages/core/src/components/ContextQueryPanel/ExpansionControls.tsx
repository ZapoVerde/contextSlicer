/**
 * @file packages/core/src/components/ContextQueryPanel/ExpansionControls.tsx
 * @stamp {"ts":"2026-02-15T09:40:00Z"}
 * @architectural-role UI Component
 * @description
 * Renders the dependency expansion controls (Step 2). Features a dual-handle 
 * slider to define the resolution gradient between full implementation text 
 * and semantic architectural summaries. Updated with strict layout constraints
 * to prevent flexbox overflow.
 *
 * @core-principles
 * 1. IS responsible for UI controls that expand the context seed.
 * 2. MUST visualize the distinction between Full and Summary extraction zones.
 * 3. ENFORCES the constraint that summary depth cannot be less than full depth.
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     state_ownership: none
 *     external_io: none
 */

import React from 'react';
import {
  Box,
  Typography,
  Stack,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
  Divider,
  Switch,
  Tooltip,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { styles } from './styles';
import type { TraceDirection } from '../hooks/useQueryPanelState/types';
import type { TraceMode, PassiveOutputMode } from '../../logic/symbolGraph/types';

interface ExpansionControlsProps {
  /** The current direction of dependency traversal. */
  traceDirection: TraceDirection;
  /** The threshold for Full Text extraction. */
  traceDepth: number;
  /** The threshold for Semantic Summary extraction. */
  summaryTraceDepth: number;
  /** Whether tracing is physical (literal imports) or logical (bypass pipes). */
  traceMode: TraceMode;
  /** How to render passive files encountered during logical tracing. */
  passiveOutputMode: PassiveOutputMode;
  /** Whether the controls should be interaction-disabled. */
  isDisabled: boolean;
  /** The current health status of the dependency graph. */
  graphStatus: 'idle' | 'building' | 'ready' | 'error';
  
  // Setters
  onSetTraceDirection: (val: TraceDirection) => void;
  onSetTraceDepth: (val: number) => void;
  onSetSummaryTraceDepth: (val: number) => void;
  onSetTraceMode: (val: TraceMode) => void;
  onSetPassiveOutputMode: (val: PassiveOutputMode) => void;
}

/**
 * @id packages/core/src/components/ContextQueryPanel/ExpansionControls.tsx#ExpansionControls
 * @description
 * Encapsulates the configuration for dependency graph traversal, featuring 
 * a dual-resolution gradient slider.
 */
export const ExpansionControls: React.FC<ExpansionControlsProps> = ({
  traceDirection,
  traceDepth,
  summaryTraceDepth,
  traceMode,
  passiveOutputMode,
  isDisabled,
  graphStatus,
  onSetTraceDirection,
  onSetTraceDepth,
  onSetSummaryTraceDepth,
  onSetTraceMode,
  onSetPassiveOutputMode,
}) => {
  const isGraphReady = graphStatus === 'ready';

  const handleSliderChange = (_: Event, newValue: number | number[]) => {
    if (Array.isArray(newValue)) {
      const [full, summary] = newValue;
      onSetTraceDepth(full);
      onSetSummaryTraceDepth(summary);
    }
  };

  return (
    <Box sx={styles.sectionContainer}>
      <Typography variant="overline" display="block" color="text.secondary">
        Step 2: Expand with Dependencies (Optional)
      </Typography>

      <Stack spacing={3} sx={styles.expansionStack}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} alignItems="center">
          <FormControl>
            <FormLabel sx={styles.formLabel}>Trace Direction</FormLabel>
            <RadioGroup
              row
              value={traceDirection}
              onChange={(e) => onSetTraceDirection(e.target.value as TraceDirection)}
            >
              <FormControlLabel 
                value="dependencies" 
                control={<Radio size="small" />} 
                label="Upstream" 
                disabled={isDisabled || !isGraphReady}
              />
              <FormControlLabel 
                value="dependents" 
                control={<Radio size="small" />} 
                label="Downstream" 
                disabled={isDisabled || !isGraphReady}
              />
              <FormControlLabel 
                value="both" 
                control={<Radio size="small" />} 
                label="Both" 
                disabled={isDisabled || !isGraphReady}
              />
            </RadioGroup>
          </FormControl>

          {/* 
            LAYOUT FIX: 
            flex: '1 1 0' and minWidth: 0 are critical here.
            Without minWidth: 0, the Slider's intrinsic width calculation can force 
            the flex item to overflow its parent in certain browser engines.
          */}
          <Box sx={{ flex: '1 1 0', minWidth: 0, width: '100%', maxWidth: 500 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
              <Typography sx={styles.formLabel}>
                Resolution Gradient (Hops)
              </Typography>
              <Tooltip title="Handle 1: Full Code limit. Handle 2: Summary limit. Files beyond Handle 2 are excluded from the pack logic but mapped in the Boundary Library.">
                <InfoOutlinedIcon sx={{ fontSize: '0.9rem', color: 'text.secondary' }} />
              </Tooltip>
            </Stack>
            
            <Slider
              value={[traceDepth, summaryTraceDepth]}
              onChange={handleSliderChange}
              step={1}
              min={0}
              max={10}
              valueLabelDisplay="auto"
              marks={[
                { value: 0, label: 'Seed' },
                { value: 2, label: 'Neighbors' },
                { value: 5, label: 'Distant' },
                { value: 10, label: 'Deep' }
              ]}
              disabled={isDisabled || !isGraphReady}
              disableSwap
              sx={sliderStyles}
            />
            
            <Stack direction="row" spacing={2} mt={1} justifyContent="center">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: 'primary.main', borderRadius: '2px' }} />
                <Typography variant="caption" color="text.secondary">Full Code (0-{traceDepth})</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: 'action.selected', borderRadius: '2px' }} />
                <Typography variant="caption" color="text.secondary">Summaries ({traceDepth + 1}-{summaryTraceDepth})</Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>

        <Divider />

        <Box sx={styles.logicalControlContainer}>
          <FormControlLabel
            control={
              <Switch
                checked={traceMode === 'logical'}
                onChange={(e) => onSetTraceMode(e.target.checked ? 'logical' : 'physical')}
                color="primary"
              />
            }
            label={
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <Typography variant="body2">Smart Trace (Bypass Pipes)</Typography>
                <Tooltip title="When ON, index files and pure re-export components (barrels) do not consume hops.">
                  <InfoOutlinedIcon sx={{ fontSize: '1rem', color: 'text.secondary' }} />
                </Tooltip>
              </Stack>
            }
            disabled={isDisabled || !isGraphReady}
          />

          <FormControl 
            size="small" 
            sx={{ minWidth: 200 }} 
            disabled={isDisabled || traceMode !== 'logical' || !isGraphReady}
          >
            <InputLabel id="passive-mode-label">Passive File Detail</InputLabel>
            <Select
              labelId="passive-mode-label"
              value={passiveOutputMode}
              label="Passive File Detail"
              onChange={(e) => onSetPassiveOutputMode(e.target.value as PassiveOutputMode)}
            >
              <MenuItem value="full">Full Content</MenuItem>
              <MenuItem value="docblock">Docblocks Only</MenuItem>
              <MenuItem value="meta">Metadata Only (Bypass)</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Stack>
    </Box>
  );
};

/**
 * Extracted styling for the Gradient Slider to visualize resolution zones.
 * Updated to ensure visual containment and correct track rendering.
 */
const sliderStyles = {
  height: 6,
  padding: '13px 0', // Ensure touch target doesn't overflow
  '& .MuiSlider-track': {
    border: 'none',
    backgroundColor: 'primary.main',
  },
  '& .MuiSlider-rail': {
    opacity: 0.3,
    backgroundColor: 'text.primary', // Clearer contrast for the rail
  },
  '& .MuiSlider-mark': {
    backgroundColor: '#bfbfbf',
    height: 8,
    width: 2, // Slightly thicker marks for visibility
    '&.MuiSlider-markActive': {
      opacity: 1,
      backgroundColor: 'currentColor',
    },
  },
} as const;