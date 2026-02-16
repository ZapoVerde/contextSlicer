/**
 * @file packages/core/src/components/ContextQueryPanel/QueryHeader.tsx
 * @stamp {"ts":"2026-02-14T13:50:00Z"}
 * @architectural-role UI Component
 * @description
 * Renders the title and diagnostic alerts for the Context Query Panel.
 * Handles the display of graph availability errors and resolution warnings.
 *
 * @core-principles
 * 1. IS a presentational component for panel status.
 * 2. MUST provide clear visual feedback on the state of the dependency graph.
 * 3. DELEGATES the display of specific warning lists to GraphWarnings.
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import React from 'react';
import { Box, Typography, Alert, AlertTitle } from '@mui/material';
import { GraphWarnings } from '../GraphWarnings';
import { styles } from './styles';

interface QueryHeaderProps {
  /** The current status of the dependency graph analysis. */
  graphStatus: 'idle' | 'building' | 'ready' | 'error';
  /** List of non-fatal errors encountered during graph resolution. */
  resolutionErrors: string[];
}

/**
 * @id packages/core/src/components/ContextQueryPanel/QueryHeader.tsx#QueryHeader
 * @description
 * Displays the main panel heading and conditional alerts based on the 
 * health of the background dependency analysis.
 */
export const QueryHeader: React.FC<QueryHeaderProps> = ({ 
  graphStatus, 
  resolutionErrors 
}) => {
  return (
    <Box sx={styles.headerStack}>
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
    </Box>
  );
};