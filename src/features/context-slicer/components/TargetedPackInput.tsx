/**
 * @file src/features/context-slicer/components/TargetedPackInput.tsx
 * @stamp {"ts":"2025-09-28T18:24:00Z"}
 * @architectural-role UI Component / Presentational (Dumb)
 *
 * @description
 * This is a stateless, "dumb" component responsible for rendering the main text
 * area for the targeted file paths and the statistics display line. It was
 * created as part of the refactoring of `TargetedPackPanel` to separate UI
 * presentation from state management and business logic.
 *
 * @contract
 * State Ownership: This component is stateless and owns no data. It is a fully
 * controlled component, receiving all its state and callbacks from its parent.
 * Public API: Accepts `value`, `onChange`, `disabled`, `fileCount`, and `tokenCount` as props.
 * Core Invariants:
 *   - MUST call the `onChange` handler when the user types in the text field.
 *   - MUST accurately display the `fileCount` and `tokenCount` it receives.
 *
 * @core-principles
 * 1. **Purely Presentational:** Contains no business logic, state hooks, or side effects.
 * 2. **Controlled Component:** Its input value is strictly controlled by the parent
 *    component via the `value` and `onChange` props.
 * 3. **Reusable:** Decoupled from the specific context of the pack generator, it could
 *    be reused for any similar input/stats display requirement.
 */

import React from 'react';
import { Stack, TextField, Typography } from '@mui/material';

interface TargetedPackInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  fileCount: number;
  tokenCount: string;
}

export const TargetedPackInput: React.FC<TargetedPackInputProps> = ({
  value,
  onChange,
  disabled,
  fileCount,
  tokenCount,
}) => {
  return (
    <Stack spacing={1} sx={{ mb: 1 }}>
      <TextField
        label="Selected file paths (comma-separated)"
        placeholder="File paths will appear here..."
        value={value}
        onChange={e => onChange(e.target.value)}
        multiline
        minRows={3}
        disabled={disabled}
      />
      <Typography variant="body2" color="text.secondary" align="right">
        Selected: {fileCount} file(s) • ~{tokenCount} tokens
      </Typography>
    </Stack>
  );
};