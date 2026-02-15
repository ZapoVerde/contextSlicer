/**
 * @file packages/core/src/components/ContextQueryPanel/ExpansionControls.tsx
 * @stamp {"ts":"2026-02-14T17:05:00Z"}
 * @architectural-role UI Component
 * @description
 * Renders the dependency expansion controls (Step 2). Features a dual-handle 
 * slider to define the resolution gradient between full implementation text 
 * and semantic architectural summaries.
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
                label="Deps" 
                disabled={isDisabled || !isGraphReady}
              />
              <FormControlLabel 
                value="dependents" 
                control={<Radio size="small" />} 
                label="Users" 
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

          <Box sx={{ flex: 1, width: '100%', maxWidth: 500 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
              <Typography sx={styles.formLabel}>
                Resolution Gradient (Hops)
              </Typography>
              <Tooltip title="Handle 1 sets the Full Extraction limit. Handle 2 sets the Summary limit. Files between them are summarized.">
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
                { value: 10, label: 'Deep' }
              ]}
              disabled={isDisabled || !isGraphReady}
              disableSwap
            />
            
            <Stack direction="row" spacing={2} mt={1} justifyContent="center">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: 'primary.main', borderRadius: '50%' }} />
                <Typography variant="caption" color="text.secondary">Full Code (Hops 0-{traceDepth})</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: 'action.disabled', borderRadius: '50%' }} />
                <Typography variant="caption" color="text.secondary">Summaries (Hops {traceDepth + 1}-{summaryTraceDepth})</Typography>
              </Box>
            </Stack>
          </Box>
        </Stack>

        <Divider />

        {/* LOGICAL TRACING CONTROLS */}
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
                <Tooltip title="When ON, index files and pure passthrough components do not consume hops.">
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