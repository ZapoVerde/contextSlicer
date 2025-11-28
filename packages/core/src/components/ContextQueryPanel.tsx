/**
 * @file packages/core/src/components/ContextQueryPanel.tsx
 * @stamp {"ts":"2025-10-03T01:34:00Z"}
 * @architectural-role UI Component / Dynamic Workflow Orchestrator
 *
 * @description
 * This component is the central user interface for building a context pack. It has
 * been refactored to be configuration-driven. Instead of containing hardcoded
 * actions, it now dynamically renders a set of "Preset" buttons by reading the
 * `presets` array from the `slicerConfig` object in the central state store.
 * This ensures the UI is always a direct reflection of the currently loaded
 * application configuration.
 *
 * @responsibilities
 * 1.  **State Consumption:** Consumes all necessary state, setters, and actions
 *     from the `useQueryPanelState` custom hook.
 * 2.  **Dynamic Rendering:** Iterates over the `presets` array provided by the
 *     hook to dynamically generate the UI for the preset actions.
 * 3.  **Component Orchestration:** Assembles the various input panels and action
 *     buttons into a cohesive, multi-step workflow for the user.
 */
import React from 'react';
import {
  Paper,
  Stack,
  Typography,
  Button,
  CircularProgress,
  ButtonGroup,
  Box,
  Divider,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
} from '@mui/material';
import { useQueryPanelState } from './hooks/useQueryPanelState';
import { DependencyTracePanel } from './DependencyTracePanel';
import { WildcardSearchPanel } from './WildcardSearchPanel';
import { DocsFolderPanel } from './DocsFolderPanel';

export const ContextQueryPanel: React.FC = () => {
  const {
    // State values
    traceQuery,
    traceDirection,
    traceDepth,
    wildcardQuery,
    isLoading,
    error,
    successMessage,
    symbolOptions,
    isReady,
    canGenerate,
    exclusionWildcardQuery,
    docsFolders,
    checkedDocsFolders,
    presets,
    

    // State setters
    setTraceQuery,
    setTraceDirection,
    setTraceDepth,
    setWildcardQuery,
    setExclusionWildcardQuery,
    handleDocsFolderToggle,

    // Actions
    handleGenerate,
    handleApplyPreset,    
  } = useQueryPanelState();

  const isDisabled = !isReady || isLoading;

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Context Query Tools
      </Typography>
      <Box sx={{ my: 2 }}>
        <Divider>
          <Typography variant="overline" color="text.secondary">
            Actions & Presets
          </Typography>
        </Divider>
        <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 2 }} alignItems="center" flexWrap="wrap">
          {/* --- Dynamically render preset buttons --- */}
          {presets.map(preset => (
            <Button
              key={preset.id}
              variant="outlined"
              size="small"
              onClick={() => handleApplyPreset(preset)}
              disabled={isDisabled}
              title={preset.summary}
            >
              {preset.name}
            </Button>
          ))}
        </Stack>
        <ButtonGroup variant="contained" disabled={isDisabled || !canGenerate} fullWidth>
          <Button
            onClick={() => handleGenerate('append')}
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {isLoading ? 'Generating...' : 'Append to Pack'}
          </Button>
          <Button
            onClick={() => handleGenerate('replace')}
            startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
          >
            {isLoading ? 'Generating...' : 'Replace Pack'}
          </Button>
        </ButtonGroup>
        {error && <Typography color="error.main" sx={{mt: 1}}>{error}</Typography>}
        {successMessage && <Typography color="success.main" sx={{mt: 1}}>{successMessage}</Typography>}
      </Box>

      {/* STEP 1: Define the Seed Files */}
      <Box sx={{ border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 1, mb: 2 }}>
        <Typography variant="overline" display="block" color="text.secondary" sx={{ mb: 1 }}>
          Step 1: Define Seed Files
        </Typography>
        {docsFolders.length > 0 && (
          <DocsFolderPanel
            folders={docsFolders}
            checkedFolders={checkedDocsFolders}
            onToggleFolder={handleDocsFolderToggle}
            disabled={isDisabled}
          />
        )}
        <DependencyTracePanel
          traceQuery={traceQuery}
          setTraceQuery={setTraceQuery}
          symbolOptions={symbolOptions}
          disabled={isDisabled}
        />
        <WildcardSearchPanel
          wildcardQuery={wildcardQuery}
          setWildcardQuery={setWildcardQuery}
          disabled={isDisabled}
        />
      </Box>

      {/* STEP 2: Expand the Selection */}
      <Box sx={{ border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 1, mb: 2 }}>
        <Typography variant="overline" display="block" color="text.secondary">
          Step 2: Expand with Dependencies (Optional)
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} alignItems="center" sx={{ mt: 1, px: 1 }}>
          <FormControl>
            <FormLabel sx={{ fontSize: '0.8rem', mb: 1 }}>Trace Direction</FormLabel>
            <RadioGroup
              row
              value={traceDirection}
              onChange={e => setTraceDirection(e.target.value as 'dependencies' | 'dependents' | 'both')}
            >
              <FormControlLabel value="dependencies" control={<Radio size="small" />} label="Dependencies" />
              <FormControlLabel value="dependents" control={<Radio size="small" />} label="Dependents" />
              <FormControlLabel value="both" control={<Radio size="small" />} label="Both" />
            </RadioGroup>
          </FormControl>
          <Box sx={{ flex: 1, width: '100%', maxWidth: 400 }}>
            <Typography gutterBottom sx={{ fontSize: '0.8rem' }}>
              Hops (0 = no trace)
            </Typography>
            <Slider
              value={traceDepth}
              onChange={(_, val) => setTraceDepth(val as number)}
              step={1}
              min={0}
              max={10}
              valueLabelDisplay="auto"
              marks
              disabled={isDisabled}
            />
          </Box>
        </Stack>
      </Box>

      {/* STEP 3: Exclusion (Sieve) */}
      <Box sx={{ border: '1px solid', borderColor: 'divider', p: 2, borderRadius: 1 }}>
        <Typography variant="overline" display="block" color="text.secondary">
          Step 3: Exclude Files (Optional)
        </Typography>
        <WildcardSearchPanel
          wildcardQuery={exclusionWildcardQuery}
          setWildcardQuery={setExclusionWildcardQuery}
          disabled={isDisabled}
          intent="exclusion"
        />
      </Box>

      {/* --- The Presets and ButtonGroup sections were moved from here --- */}

    </Paper>
  );
};