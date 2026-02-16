/**
 * @file packages/core/src/components/TargetedPackPanel.tsx
 * @stamp {"ts":"2026-02-16T17:25:00Z"}
 * @architectural-role UI Component / Container
 * @description
 * The composition root for the Targeted Pack Generator panel. Orchestrates the
 * data flow between the business logic hook and the presentational components.
 * 
 * @core-principles
 * 1. CONTAINER/PRESENTER: OWNS the coordination of state and presentational sub-components.
 * 2. SINGLE RESPONSIBILITY: IS strictly responsible for framing the generator feature.
 * 3. PASSIVE VIEW: MUST NOT contain direct business logic or side effects.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     state_ownership: none # Delegates to useTargetedPackManager.
 *     external_io: none
 */

import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { useTargetedPackManager } from './hooks/useTargetedPackManager/index.js';
import { TargetedPackInput } from './TargetedPackInput.js';
import { TargetedPackActions } from './TargetedPackActions.js';

/**
 * @id packages/core/src/components/TargetedPackPanel.tsx#TargetedPackPanel
 * @description
 * Main layout container for the Targeted Pack generation interface.
 */
export const TargetedPackPanel: React.FC = () => {
  const {
    isReady,
    canExport,
    targetedPathsInput,
    selectedCount,
    approxTokens,
    isAssembling,
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

  return (
    <Paper variant="outlined" sx={styles.root}>
      <Typography variant="h6" gutterBottom>
        Targeted Pack Generator
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={styles.description}>
        This area is the source of truth for your context pack. Edit it directly, 
        or use the helper tools below to append or replace its content.
      </Typography>

      <TargetedPackInput
        value={targetedPathsInput}
        onChange={setTargetedPathsInput}
        // Trigger 1 (Editing the list) is never locked out.
        disabled={!isReady}
        fileCount={selectedCount}
        tokenCount={approxTokens}
      />

      <Box sx={styles.actionsWrapper}>
        <TargetedPackActions
          canExport={canExport}
          // Pass the assembly status to drive the Trigger 2 lockout
          isAssembling={isAssembling}
          preambleOnly={preambleOnly}
          docblocksOnly={docblocksOnly}
          onCopy={handleCopyToClipboard}
          onDownloadTxt={handleDownloadTxt}
          onDownloadZip={handleDownloadZip}
          onCopyTree={handleCopyTreeOnly}
          onPreambleOnlyChange={setPreambleOnly}
          onDocblocksOnlyChange={setDocblocksOnly}
        />
      </Box>
    </Paper>
  );
};

/**
 * Visual abstraction of layout values.
 */
const styles = {
  root: {
    p: 2,
    mt: 2
  },
  description: {
    mb: 1
  },
  actionsWrapper: {
    mt: 1
  }
} as const;