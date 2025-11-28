/**
 * @file packages/core/src/components/sourceDump/CopyButton.tsx
 * @stamp {"ts":"2025-09-26T16:10:00Z"}
 * @architectural-role UI Presentation Component (Dumb)
 *
 * @description
 * A small, self-contained UI component that renders a button to copy a specified
 * text string to the user's clipboard. It provides immediate visual feedback to the
 * user by changing its text to "Copied" for a brief period upon success.
 *
 * @contract
 * Public API: Accepts `textToCopy` (the string to be copied), an optional `title`
 * for the button's tooltip, and an optional `sx` prop for custom styling.
 * State Ownership: Owns its local, transient UI state (`copied`) to manage the
 * button's label. It does not hold any application-level state.
 * Core Invariants:
 *   - The component MUST be provided with a `textToCopy` string.
 *   - It MUST use the `navigator.clipboard.writeText` browser API to perform the copy action.
 *
 * @core-principles
 * 1. IS a self-contained, reusable UI component.
 * 2. OWNS the logic and transient state for the copy-to-clipboard interaction.
 * 3. MUST receive the text to copy via its props.
 * 4. MUST NOT contain any business logic unrelated to its primary function of copying text.
 */

import React, { useCallback, useState } from 'react';
import { Button,  } from '@mui/material';
import type {  SxProps,  Theme } from '@mui/material';

export const CopyButton: React.FC<{ textToCopy: string; title?: string; sx?: SxProps<Theme> }> = ({ textToCopy, title, sx }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (_err) {
      // no-op
    }
  }, [textToCopy]);

  return (
    <Button size="small" variant="outlined" onClick={handleCopy} sx={sx} title={title || 'Copy'}>
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
};