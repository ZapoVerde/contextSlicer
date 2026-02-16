/**
 * @file packages/core/src/components/ContextQueryPanel/index.tsx
 * @stamp {"ts":"2026-02-14T17:10:00Z"}
 * @architectural-role UI Component / Orchestrator
 * @description
 * The composition root for the Context Query Panel feature. It orchestrates the
 * user workflow for selecting files, tracing dependencies, and generating
 * context packs. Updated to support dual-resolution ticker wiring.
 *
 * @core-principles
 * 1. ORCHESTRATES the integration of state logic and presentation components.
 * 2. ENFORCES the three-step workflow (Seed -> Expand -> Exclude).
 * 3. DELEGATES all business logic to the `useQueryPanelState` hook.
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     state_ownership: none
 *     external_io: none
 */

import React from 'react';
import { Paper, Box, Typography } from '@mui/material';
import { useQueryPanelState } from '../hooks/useQueryPanelState';
import { DependencyTracePanel } from '../DependencyTracePanel';
import { WildcardSearchPanel } from '../WildcardSearchPanel';
import { DocsFolderPanel } from '../DocsFolderPanel';

// Sub-components
import { QueryHeader } from './QueryHeader';
import { QueryActions } from './QueryActions';
import { ExpansionControls } from './ExpansionControls';
import { styles } from './styles';

/**
 * @id packages/core/src/components/ContextQueryPanel/index.tsx#ContextQueryPanel
 * @description
 * Main container for the Context Query interface.
 */
export const ContextQueryPanel: React.FC = () => {
  const {
    // State values
    traceQuery,
    traceDirection,
    traceDepth,
    summaryTraceDepth,
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
    setSummaryTraceDepth,
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
      {/* Header & Diagnostics */}
      <QueryHeader 
        graphStatus={graphStatus} 
        resolutionErrors={resolutionErrors} 
      />

      {/* Global Actions */}
      <QueryActions
        presets={presets}
        isDisabled={isDisabled}
        canGenerate={canGenerate}
        isLoading={isLoading}
        error={error}
        successMessage={successMessage}
        onApplyPreset={handleApplyPreset}
        onGenerate={handleGenerate}
      />

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
          intent="inclusion"
        />
      </Box>

      {/* STEP 2: Expand the Selection */}
      <ExpansionControls
        traceDirection={traceDirection}
        traceDepth={traceDepth}
        summaryTraceDepth={summaryTraceDepth}
        traceMode={traceMode}
        passiveOutputMode={passiveOutputMode}
        isDisabled={isDisabled}
        graphStatus={graphStatus}
        onSetTraceDirection={setTraceDirection}
        onSetTraceDepth={setTraceDepth}
        onSetSummaryTraceDepth={setSummaryTraceDepth}
        onSetTraceMode={setTraceMode}
        onSetPassiveOutputMode={setPassiveOutputMode}
      />

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