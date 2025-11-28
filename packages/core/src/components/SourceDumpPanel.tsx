/**
 * @file packages/core/src/components/SourceDumpPanel.tsx
 * @architectural-role UI Component / Layout Container
 *
 * @description This component acts as the main layout container for the Source Dump
 * feature's user interface. It is rendered only after the source zip has been
 * successfully loaded and processed. Its primary responsibility is to arrange the
 * core functional panels into a simple and efficient user experience.
 *
 * @responsibilities
 * 1.  **Data Fetching:** Uses the `useDumpManifest` hook to retrieve top-level
 *     metadata about the loaded source dump, such as its generation timestamp.
 * 2.  **Component Orchestration:** Renders the suite of UI panels in the correct
 *     order for the desired user workflow.
 */
import React from 'react';
import { Box } from '@mui/material';
import { TargetedPackPanel } from './TargetedPackPanel';
import { ContextQueryPanel } from './ContextQueryPanel';

export const SourceDumpPanel: React.FC = () => {
  return (
    <Box p={2} pt={0}>
      <TargetedPackPanel />
      <ContextQueryPanel />
    </Box>
  );
};