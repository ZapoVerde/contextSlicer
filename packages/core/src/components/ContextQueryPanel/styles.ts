/**
 * @file packages/core/src/components/ContextQueryPanel/styles.ts
 * @stamp {"ts":"2026-02-14T13:45:00Z"}
 * @architectural-role Configuration
 * @description
 * Centralized style definitions for the ContextQueryPanel and its sub-components.
 * Follows the Principle of Visual Abstraction to keep JSX clean and maintainable.
 *
 * @core-principles
 * 1. ENFORCES visual consistency across the Query Panel module.
 * 2. MUST contain all non-dynamic "magic" layout values.
 * 3. IS a pure configuration object.
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { SxProps, Theme } from '@mui/material';

/**
 * @id packages/core/src/components/ContextQueryPanel/styles.ts#Styles
 * @description Type definition for the shared styles object.
 */
interface Styles {
  root: SxProps<Theme>;
  sectionContainer: SxProps<Theme>;
  formLabel: SxProps<Theme>;
  headerStack: SxProps<Theme>;
  actionContainer: SxProps<Theme>;
  expansionStack: SxProps<Theme>;
  logicalControlContainer: SxProps<Theme>;
}

export const styles: Styles = {
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
    color: 'text.secondary',
  },
  headerStack: {
    mb: 2,
  },
  actionContainer: {
    my: 2,
  },
  expansionStack: {
    mt: 2,
    px: 1,
  },
  logicalControlContainer: {
    mt: 2,
    display: 'flex',
    flexDirection: { xs: 'column', sm: 'row' },
    gap: 3,
    alignItems: 'flex-end',
  },
} as const;