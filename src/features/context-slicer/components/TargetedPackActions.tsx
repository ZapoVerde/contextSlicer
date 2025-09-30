/**
 * @file src/features/context-slicer/components/TargetedPackActions.tsx
 * @stamp {"ts":"2025-09-28T18:24:00Z"}
 * @architectural-role UI Component / Presentational (Dumb)
 *
 * @description
 * This is a stateless component responsible for rendering the action buttons
 * (e.g., "Copy", "Download") and option checkboxes for the Targeted Pack Generator.
 * It was created by refactoring `TargetedPackPanel` to isolate the UI controls
 * from the logic they trigger.
 *
 * @contract
 * State Ownership: This component is stateless and owns no data. It receives all
 * its state and callbacks from its parent.
 * Public API: Accepts props for the state of all controls (`canExport`,
 * `preambleOnly`, etc.) and callback handlers for all user interactions (`onCopy`,
 * `onPreambleOnlyChange`, etc.).
 * Core Invariants:
 *   - MUST correctly enable or disable buttons based on the `canExport` prop.
 *   - MUST accurately reflect the state of the checkboxes via their respective props.
 *   - MUST call the appropriate `on...` handler when a user interacts with a control.
 *
 * @core-principles
 * 1. **Purely Presentational:** Contains no business logic or side effects.
 * 2. **Controlled Component:** All control states are strictly managed by the parent.
 * 3. **Clear Responsibility:** Its single responsibility is to provide the user
 *    interface for initiating export actions and configuring their options.
 */
import React from 'react';
import { Stack, Button, Box, FormControlLabel, Checkbox, Typography } from '@mui/material';

interface TargetedPackActionsProps {
  canExport: boolean;
  preambleOnly: boolean;
  docblocksOnly: boolean;
  onCopy: () => void;
  onDownloadTxt: () => void;
  onDownloadZip: () => void;
  onCopyTree: () => void;
  onPreambleOnlyChange: (checked: boolean) => void;
  onDocblocksOnlyChange: (checked: boolean) => void;
}

export const TargetedPackActions: React.FC<TargetedPackActionsProps> = ({
  canExport,
  preambleOnly,
  docblocksOnly,
  onCopy,
  onDownloadTxt,
  onDownloadZip,
  onCopyTree,
  onPreambleOnlyChange,
  onDocblocksOnlyChange,
}) => {
  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
      {!preambleOnly && (
        <>
          <Button variant="contained" onClick={onCopy} disabled={!canExport}>
            Copy to Clipboard
          </Button>
          <Button variant="outlined" onClick={onDownloadTxt} disabled={!canExport}>
            Download Txt
          </Button>
          <Button variant="outlined" onClick={onDownloadZip} disabled={!canExport}>
            Download Zip
          </Button>
        </>
      )}
      {preambleOnly && (
        <Button variant="contained" onClick={onCopyTree} disabled={!canExport}>
          Copy Tree Only
        </Button>
      )}

      {/* --- START OF CHANGE: Align checkbox group to the left --- */}
      <Box sx={{ ml: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={preambleOnly}
              onChange={e => {
                onPreambleOnlyChange(e.target.checked);
                if (e.target.checked) {
                  onDocblocksOnlyChange(false);
                }
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