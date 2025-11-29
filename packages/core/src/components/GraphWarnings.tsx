/**
 * @file packages/core/src/components/GraphWarnings.tsx
 * @stamp {"ts":"2025-11-29T03:45:00Z"}
 * @architectural-role UI Component
 *
 * @description
 * A collapsible alert component designed to display non-fatal errors generated
 * during the Symbol Graph analysis. It allows users to copy the error log
 * for debugging purposes without cluttering the main UI.
 *
 * @core-principles
 * 1. IS a presentational component for error lists.
 * 2. MUST allow the user to easily copy the full error text.
 * 3. DEFAULTS to a collapsed state to reduce noise.
 *
 * @contract
 *   assertions:
 *     purity: pure # React component with internal UI state.
 *     state_ownership: [expanded, copied]
 *     external_io: clipboard
 */

import React, { useState } from 'react';
import { 
  Alert, 
  AlertTitle, 
  Box, 
  Collapse, 
  IconButton, 
  Tooltip,
  Typography,
  Stack
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface GraphWarningsProps {
  warnings: string[];
}

export const GraphWarnings: React.FC<GraphWarningsProps> = ({ warnings }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!warnings || warnings.length === 0) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(warnings.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Alert 
      severity="warning" 
      icon={<WarningAmberIcon />}
      sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" width="100%">
        <Box>
          <AlertTitle>Analysis Warnings</AlertTitle>
          <Typography variant="body2">
            The dependency graph was built, but {warnings.length} file(s) had issues and were skipped.
          </Typography>
        </Box>
        <Stack direction="row">
          <Tooltip title={copied ? "Copied!" : "Copy Errors"}>
            <IconButton size="small" onClick={handleCopy}>
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Stack>
      </Stack>

      <Collapse in={expanded}>
        <Box 
          component="pre" 
          sx={{ 
            mt: 2, 
            p: 1.5, 
            bgcolor: 'rgba(0, 0, 0, 0.06)', 
            borderRadius: 1, 
            fontSize: '0.75rem',
            overflowX: 'auto',
            maxHeight: '200px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}
        >
          {warnings.join('\n')}
        </Box>
      </Collapse>
    </Alert>
  );
};