/**
 * @file packages/core/src/components/ContextQueryPanel.tsx
 * @stamp {"ts":"2026-02-14T08:35:00Z"}
 * @architectural-role UI Component
 * @description
 * The central user interface for building context packs. Enhanced with logical 
 * tracing controls (Smart Trace) and passive file output configuration to 
 * maximize token efficiency.
 * 
 * @core-principles
 * 1. ORCHESTRATES the user workflow for selecting context.
 * 2. ENFORCES the separation of seed definition from logical expansion.
 * 3. DELEGATES state and trace logic to the useQueryPanelState hook.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     state_ownership: none
 *     external_io: none
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
  Alert,
  AlertTitle,
  Switch,
  Select,
  MenuItem,
  InputLabel,
  Tooltip,
} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useQueryPanelState } from './hooks/useQueryPanelState';
import { DependencyTracePanel } from './DependencyTracePanel';
import { WildcardSearchPanel } from './WildcardSearchPanel';
import { DocsFolderPanel } from './DocsFolderPanel';
import { GraphWarnings } from './GraphWarnings';

export const ContextQueryPanel: React.FC = () => {
  const {
    // State values
    traceQuery,
    traceDirection,
    traceDepth,
    traceMode,
    passiveOutputMode,
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
    graphStatus,
    resolutionErrors,

    // State setters
    setTraceQuery,
    setTraceDirection,
    setTraceDepth,
    setTraceMode,
    setPassiveOutputMode,
    setWildcardQuery,
    setExclusionWildcardQuery,
    handleDocsFolderToggle,

    // Actions
    handleGenerate,
    handleApplyPreset,    
  } = useQueryPanelState();

  const isDisabled = !isReady || isLoading;

  return (
    <Paper variant="outlined" sx={styles.root}>
      <Typography variant="h6" gutterBottom>
        Context Query Tools
      </Typography>

      {/* CRITICAL FAILURE ALERT */}
      {graphStatus === 'error' && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Dependency Graph Unavailable</AlertTitle>
          Tracing features are disabled. You can still select files manually or via wildcards.
        </Alert>
      )}

      {/* PARTIAL SUCCESS WARNINGS */}
      {graphStatus === 'ready' && resolutionErrors.length > 0 && (
        <GraphWarnings warnings={resolutionErrors} />
      )}

      <Box sx={{ my: 2 }}>
        <Divider>
          <Typography variant="overline" color="text.secondary">
            Actions & Presets
          </Typography>
        </Divider>
        <Stack direction="row" spacing={1} sx={{ mt: 1, mb: 2 }} alignItems="center" flexWrap="wrap">
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
      <Box sx={styles.sectionContainer}>
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
      <Box sx={styles.sectionContainer}>
        <Typography variant="overline" display="block" color="text.secondary">
          Step 2: Expand with Dependencies (Optional)
        </Typography>
        
        <Stack spacing={3} sx={{ mt: 2, px: 1 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} alignItems="center">
            <FormControl>
              <FormLabel sx={styles.formLabel}>Trace Direction</FormLabel>
              <RadioGroup
                row
                value={traceDirection}
                onChange={e => setTraceDirection(e.target.value as any)}
              >
                <FormControlLabel value="dependencies" control={<Radio size="small" />} label="Deps" />
                <FormControlLabel value="dependents" control={<Radio size="small" />} label="Users" />
                <FormControlLabel value="both" control={<Radio size="small" />} label="Both" />
              </RadioGroup>
            </FormControl>

            <Box sx={{ flex: 1, width: '100%', maxWidth: 400 }}>
              <Typography gutterBottom sx={styles.formLabel}>
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
                disabled={isDisabled || graphStatus !== 'ready'}
              />
            </Box>
          </Stack>

          <Divider />

          {/* NEW: LOGICAL TRACING CONTROLS */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="flex-end">
            <FormControlLabel
              control={
                <Switch 
                  checked={traceMode === 'logical'} 
                  onChange={(e) => setTraceMode(e.target.checked ? 'logical' : 'physical')}
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
              disabled={isDisabled || graphStatus !== 'ready'}
            />

            <FormControl size="small" sx={{ minWidth: 200 }} disabled={isDisabled || traceMode !== 'logical'}>
              <InputLabel id="passive-mode-label">Passive File Detail</InputLabel>
              <Select
                labelId="passive-mode-label"
                value={passiveOutputMode}
                label="Passive File Detail"
                onChange={(e) => setPassiveOutputMode(e.target.value as any)}
              >
                <MenuItem value="full">Full Content</MenuItem>
                <MenuItem value="docblock">Docblocks Only</MenuItem>
                <MenuItem value="meta">Metadata Only (Bypass)</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Stack>
      </Box>

      {/* STEP 3: Exclusion (Sieve) */}
      <Box sx={styles.sectionContainer}>
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
    </Paper>
  );
};

const styles = {
  root: {
    p: 2,
    mt: 2,
  },
  sectionContainer: {
    border: '1px solid',
    borderColor: 'divider',
    p: 2,
    borderRadius: 1,
    mb: 2,
  },
  formLabel: {
    fontSize: '0.8rem',
    mb: 1,
  },
} as const;