/**
 * @file packages/core/src/components/ContextQueryPanel/QueryActions.tsx
 * @stamp {"ts":"2026-02-14T14:15:00Z"}
 * @architectural-role UI Component
 * @description
 * Renders the primary action controls for the Query Panel, including the
 * preset application buttons and the Generate (Append/Replace) ButtonGroup.
 *
 * @core-principles
 * 1. IS responsible for rendering the primary workflow triggers.
 * 2. ENFORCES visual grouping of related actions and presets.
 * 3. DELEGATES logic execution to the parent's orchestrated handlers.
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     state_ownership: none
 *     external_io: none
 */

import React from 'react';
import { 
  Box, 
  Divider, 
  Typography, 
  Stack, 
  Button, 
  ButtonGroup, 
  CircularProgress 
} from '@mui/material';
import { styles } from './styles';
import type { QueryPanelPreset } from '../hooks/useQueryPanelState/types';

interface QueryActionsProps {
  /** The list of available query presets. */
  presets: QueryPanelPreset[];
  /** Whether the component should be disabled (e.g., during loading or if not ready). */
  isDisabled: boolean;
  /** Whether the generation buttons are enabled based on query validity. */
  canGenerate: boolean;
  /** Whether an active generation operation is in progress. */
  isLoading: boolean;
  /** Potential error message from the last operation. */
  error: string | null;
  /** Success message from the last operation. */
  successMessage: string | null;
  /** Handler for applying a selected preset. */
  onApplyPreset: (preset: QueryPanelPreset) => void;
  /** Handler for initiating pack generation. */
  onGenerate: (mode: 'append' | 'replace') => void;
}

/**
 * @id packages/core/src/components/ContextQueryPanel/QueryActions.tsx#QueryActions
 * @description
 * Provides the user interface for applying pre-configured presets and 
 * executing the final context pack generation logic.
 */
export const QueryActions: React.FC<QueryActionsProps> = ({
  presets,
  isDisabled,
  canGenerate,
  isLoading,
  error,
  successMessage,
  onApplyPreset,
  onGenerate,
}) => {
  return (
    <Box sx={styles.actionContainer}>
      <Divider>
        <Typography variant="overline" color="text.secondary">
          Actions & Presets
        </Typography>
      </Divider>

      <Stack 
        direction="row" 
        spacing={1} 
        sx={{ mt: 1, mb: 2 }} 
        alignItems="center" 
        flexWrap="wrap"
      >
        {presets.map((preset) => (
          <Button
            key={preset.id}
            variant="outlined"
            size="small"
            onClick={() => onApplyPreset(preset)}
            disabled={isDisabled}
            title={preset.summary}
          >
            {preset.name}
          </Button>
        ))}
      </Stack>

      <ButtonGroup 
        variant="contained" 
        disabled={isDisabled || !canGenerate} 
        fullWidth
      >
        <Button
          onClick={() => onGenerate('append')}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isLoading ? 'Generating...' : 'Append to Pack'}
        </Button>
        <Button
          onClick={() => onGenerate('replace')}
          startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isLoading ? 'Generating...' : 'Replace Pack'}
        </Button>
      </ButtonGroup>

      {error && (
        <Typography color="error.main" sx={{ mt: 1, fontSize: '0.875rem' }}>
          {error}
        </Typography>
      )}
      {successMessage && (
        <Typography color="success.main" sx={{ mt: 1, fontSize: '0.875rem' }}>
          {successMessage}
        </Typography>
      )}
    </Box>
  );
};