/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/usePackStats.ts
 * @stamp {"ts":"2026-02-15T11:25:00Z"}
 * @architectural-role Custom Hook / Logic
 * @description
 * Responsible for calculating real-time statistics for the current selection of 
 * targeted paths. It provides count and estimated size metrics, applying a 
 * heuristic reduction for files flagged for summary resolution.
 * 
 * @core-principles
 * 1. OWNS the logic for context pack size estimation.
 * 2. MUST provide reactive updates whenever targets or the file index changes.
 * 3. ENFORCES size-reduction heuristics for summarized content.
 * 
 * @contract
 *   assertions:
 *     purity: mutates # Managed via useEffect/useState.
 *     state_ownership: [selectedCount, selectedBytes]
 *     external_io: none
 */

import { useState, useEffect, useMemo } from 'react';
import type { FileEntry } from '../../../state/slicer-state';
import type { TargetedPath } from './types';

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/usePackStats.ts#usePackStats
 * @description
 * Calculates the number of selected files and an estimated byte size. 
 * Summarized files are estimated at 10% of original size or 500 bytes (whichever is smaller)
 * to provide a more accurate token forecast.
 * 
 * @param fileIndex - The registry of available files.
 * @param parsedTargets - The structured list of targets to analyze.
 */
export function usePackStats(
  fileIndex: Map<string, FileEntry> | null,
  parsedTargets: TargetedPath[]
) {
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const [selectedBytes, setSelectedBytes] = useState<number>(0);

  useEffect(() => {
    if (!fileIndex || parsedTargets.length === 0) {
      setSelectedCount(0);
      setSelectedBytes(0);
      return;
    }

    let count = 0;
    let bytes = 0;

    for (const target of parsedTargets) {
      const entry = fileIndex.get(target.path);
      if (entry) {
        count++;
        // Size Heuristic: Summaries are significantly smaller.
        // We cap summary estimates to prevent large files from skewing the "Brief" estimate.
        if (target.resolution === 'summary') {
          bytes += Math.min(entry.size * 0.1, 500);
        } else {
          bytes += entry.size;
        }
      }
    }

    setSelectedCount(count);
    setSelectedBytes(bytes);
  }, [fileIndex, parsedTargets]);

  // Derived formatting for the UI
  const approxTokens = useMemo(() => {
    return Math.round(selectedBytes / 4).toLocaleString();
  }, [selectedBytes]);

  return {
    selectedCount,
    selectedBytes,
    approxTokens
  };
}