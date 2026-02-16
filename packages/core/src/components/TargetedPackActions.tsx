/**
 * @file packages/core/src/components/TargetedPackActions.tsx
 * @stamp {"ts":"2026-02-16T17:35:00Z"}
 * @architectural-role UI Component / Presentational (Dumb)
 * @description
 * Renders the primary action controls for the context pack generator. Implements 
 * visual lockout logic for Trigger 2 (Exporting) while background assembly is 
 * in progress.
 *
 * @core-principles
 * 1. PURELY PRESENTATIONAL: MUST NOT contain business logic or side effects.
 * 2. FEEDBACK ORIENTED: Provides clear visual status of background assembly.
 * 3. CONTROLLED COMPONENT: States and handlers are strictly managed by the parent.
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     state_ownership: none
 *     external_io: none
 */

import React from 'react';
import { Stack, Button, Box, FormControlLabel, Checkbox, Typography, CircularProgress } from '@mui/material';

interface TargetedPackActionsProps {
  /** True if the export actions are valid and background assembly is complete. */
  canExport: boolean;
  /** True if the background worker is currently building the pack. */
  isAssembling: boolean;
  /** True if the assembly engine is restricted to the file tree. */
  preambleOnly: boolean;
  /** True if the assembly engine is restricted to JSDoc/Preambles. */
  docblocksOnly: boolean;
  
  // Handlers
  onCopy: () => void;
  onDownloadTxt: () => void;
  onDownloadZip: () => void;
  onCopyTree: () => void;
  onPreambleOnlyChange: (checked: boolean) => void;
  onDocblocksOnlyChange: (checked: boolean) => void;
}

/**
 * @id packages/core/src/components/TargetedPackActions.tsx#TargetedPackActions
 * @description
 * Visual control suite for initiating context pack exports.
 */
export const TargetedPackActions: React.FC<TargetedPackActionsProps> = ({
  canExport,
  isAssembling,
  preambleOnly,
  docblocksOnly,
  onCopy,
  onDownloadTxt,
  onDownloadZip,
  onCopyTree,
  onPreambleOnlyChange,
  onDocblocksOnlyChange,
}) => {
  // Lock out the primary export buttons during background assembly
  const isPrimaryDisabled = !canExport || isAssembling;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
      {!preambleOnly ? (
        <>
          <Button 
            variant="contained" 
            onClick={onCopy} 
            disabled={isPrimaryDisabled}
            startIcon={isAssembling ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {isAssembling ? 'Assembling...' : 'Copy to Clipboard'}
          </Button>
          <Button 
            variant="outlined" 
            onClick={onDownloadTxt} 
            disabled={isPrimaryDisabled}
          >
            Download Txt
          </Button>
          <Button 
            variant="outlined" 
            onClick={onDownloadZip} 
            disabled={isPrimaryDisabled}
          >
            Download Zip
          </Button>
        </>
      ) : (
        <Button 
          variant="contained" 
          onClick={onCopyTree} 
          disabled={isPrimaryDisabled}
        >
          {isAssembling ? 'Building Tree...' : 'Copy Tree Only'}
        </Button>
      )}

      <Box sx={styles.checkboxStack}>
        <FormControlLabel
          control={
            <Checkbox
              checked={preambleOnly}
              onChange={e => {
                onPreambleOnlyChange(e.target.checked);
                if (e.target.checked) onDocblocksOnlyChange(false);
              }}
              size="small"
            />
          }
          label={<Typography variant="body2">Tree Only</Typography>}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={docblocksOnly}
              onChange={e => {
                onDocblocksOnlyChange(e.target.checked);
                if (e.target.checked) onPreambleOnlyChange(false);
              }}
              size="small"
            />
          }
          label={<Typography variant="body2">Docblocks Only</Typography>}
        />
      </Box>
    </Stack>
  );
};

/**
 * Visual abstraction of layout values.
 */
const styles = {
  checkboxStack: {
    ml: 'auto', 
    display: 'flex', 
    flexDirection: 'column', 
    alignItems: 'flex-start' 
  }
} as const;