/**
 * @file src/features/sourceDump/components/GlobalDumpsCard.tsx
 * @architectural-role UI Component / Feature Panel
 *
 * @description This component renders a panel that provides convenient links for
 * downloading the entire, unfiltered source dump as either a single `.txt` file or
 * a `.zip` archive.
 *
 * @responsibilities
 * 1.  **URL Resolution:** It uses the `useDumpManifest` hook to get the correctly
 *     resolved, public-facing URLs for the global dump artifacts.
 * 2.  **Action Rendering:** It displays buttons for downloading the artifacts and for
 *     copying the URL of the text artifact to the clipboard.
 * 3.  **Staleness Safety:** It consumes the `useFreshnessStatus` hook to disable all
 *     download and copy buttons if the source data is stale. This prevents the user
 *     from accidentally downloading an out-of-date package.
 * 4.  **Conditional Display:** The download links are only shown when the data source
 *     is the live dev server, as they are not relevant when viewing a pre-packaged,
 *     user-uploaded zip file.
 */
import React from 'react';
import { Paper, Stack, Typography, Button } from '@mui/material';
import { useDumpManifest } from './useDumpManifest';
import { useFreshnessStatus } from '../hooks/useFreshnessStatus';
import { CopyButton } from './CopyButton';

export const GlobalDumpsCard: React.FC<{ generatedAt?: string }> = ({ generatedAt }) => {
  const { isStale, source } = useFreshnessStatus();
  const { concatTxtUrl, concatZipUrl } = useDumpManifest();

  const originSafe = typeof window !== 'undefined' ? window.location.origin : '';
  const absoluteTxtUrl = concatTxtUrl ? `${originSafe}${concatTxtUrl}` : '';
  const canExport = source === 'dev' && !isStale;

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="h5" gutterBottom>
        Global Dumps
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Entire repository content (honors .gitignore).
        {generatedAt ? ` Generated ${new Date(generatedAt).toLocaleString()}.` : ''}
      </Typography>

      {source === 'dev' && concatTxtUrl && concatZipUrl ? (
        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
          <Button variant="outlined" href={concatTxtUrl} download="source-dump.txt" disabled={!canExport}>
            Download All as .txt
          </Button>
          <CopyButton textToCopy={absoluteTxtUrl} title="Copy link to .txt" sx={{pointerEvents: !canExport ? 'none' : 'auto', opacity: !canExport ? 0.5 : 1}} />
          <Button variant="outlined" href={concatZipUrl} download="source-dump.zip" disabled={!canExport}>
            Download All as .zip
          </Button>
        </Stack>
      ) : (
        <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
          Global downloads are not available when viewing a local zip file.
        </Typography>
      )}
    </Paper>
  );
};