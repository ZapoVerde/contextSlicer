/**
 * @file src/features/context-slicer/components/TargetedPackPanel.tsx
 * @stamp {"ts":"2025-09-28T18:24:00Z"}
 * @architectural-role UI Component / Container
 *
 * @description
 * This component serves as the container and entry point for the "Targeted Pack
 * Generator" feature. After being refactored to separate concerns, its sole
 * responsibility is to orchestrate the rendering of its child components. It
 * contains no direct business logic or local state.
 *
 * @contract
 * Public API: This component has no props.
 * State Ownership: This component is stateless. It defers all state management
 * to the `useTargetedPackManager` hook.
 * Core Invariants:
 *   - MUST call the `useTargetedPackManager` hook to get all necessary state and actions.
 *   - MUST render the `TargetedPackInput` and `TargetedPackActions` child components.
 *   - MUST correctly wire the state and actions from the hook to the props of the
 *     child components.
 *
 * @core-principles
 * 1. **Container/Presenter Pattern:** Acts as a "Container" component, managing data
 *    flow from the logic hook to the "Presenter" components.
 * 2. **Single Responsibility:** Its only responsibility is to compose the feature's
 *    UI from its constituent parts.
 * 3. **Readability:** Provides a clean, high-level overview of the feature's
 *    structure without being cluttered by implementation details.
 */
import React from 'react';
import { Paper, Typography } from '@mui/material';
import { useTargetedPackManager } from './hooks/useTargetedPackManager';
import { TargetedPackInput } from './TargetedPackInput';
import { TargetedPackActions } from './TargetedPackActions';

export const TargetedPackPanel: React.FC = () => {
  // --- START OF CHANGE (1/2): Remove unused state variables from destructuring ---
  const {
    isReady,
    canExport,
    targetedPathsInput,
    selectedCount,
    approxTokens,
    preambleOnly,
    docblocksOnly,
    setTargetedPathsInput,
    setPreambleOnly,
    setDocblocksOnly,
    handleCopyToClipboard,
    handleDownloadTxt,
    handleDownloadZip,
    handleCopyTreeOnly,
  } = useTargetedPackManager();
  // --- END OF CHANGE (1/2) ---

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Targeted Pack Generator
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        This area is the source of truth for your context pack. Edit it directly, or use the
        helper tools below to append or replace its content.
      </Typography>

      <TargetedPackInput
        value={targetedPathsInput}
        onChange={setTargetedPathsInput}
        disabled={!isReady}
        fileCount={selectedCount}
        tokenCount={approxTokens}
      />

      {/* --- START OF CHANGE (2/2): Remove the prop from the child component --- */}
      <TargetedPackActions
        canExport={canExport}
        preambleOnly={preambleOnly}
        docblocksOnly={docblocksOnly}
        onCopy={handleCopyToClipboard}
        onDownloadTxt={handleDownloadTxt}
        onDownloadZip={handleDownloadZip}
        onCopyTree={handleCopyTreeOnly}
        onPreambleOnlyChange={setPreambleOnly}
        onDocblocksOnlyChange={setDocblocksOnly}
      />
      {/* --- END OF CHANGE (2/2) --- */}
    </Paper>
  );
};