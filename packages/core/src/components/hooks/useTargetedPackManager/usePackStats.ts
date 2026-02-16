/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/usePackStats.ts
 * @stamp {"ts":"2026-02-16T16:15:00Z"}
 * @architectural-role Custom Hook / Logic
 * @description
 * Manages the presentation logic for context pack statistics. Implements a 
 * "Fallback to Accuracy" pattern:
 * 1. Immediate: Heuristic (1.6x multiplier) for instant UI feedback.
 * 2. Deferred: Actual Tiktoken BPE count retrieved from the global store 
 *    once the background assembly worker finishes.
 * 
 * @core-principles
 * 1. OWNS the mapping of raw bytes and worker results to UI-friendly strings.
 * 2. MUST use granular selectors to prevent unnecessary re-renders of the stats line.
 * 3. ENFORCES visual distinction between estimated and accurate states.
 * 
 * @contract
 *   assertions:
 *     purity: mutates # Consumes external store state.
 *     state_ownership: [localHeuristicStats]
 *     external_io: none
 */

import { useState, useEffect, useMemo } from 'react';
import { useSlicerStore } from '../../../state/useSlicerStore.js';
import type { FileEntry } from '../../../state/slicer-state.js';
import type { TargetedPath } from './types.js';

const CODE_SAFETY_FACTOR = 1.6;

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/usePackStats.ts#usePackStats
 * @description
 * Aggregates local heuristic data and global background worker data into 
 * a single reactive statistics object.
 */
export function usePackStats(
  fileIndex: Map<string, FileEntry> | null,
  parsedTargets: TargetedPath[]
) {
  // 1. Local state for the "Fast" heuristic layer
  const [heuristicStats, setHeuristicStats] = useState({ count: 0, bytes: 0 });

  // 2. Granular selectors for the "Accurate" worker layer
  const accurateTokenCount = useSlicerStore(s => s.accurateTokenCount);
  const isAssembling = useSlicerStore(s => s.isAssembling);

  // --- LAYER 1: HEURISTIC (Synchronous Metadata Calculation) ---
  useEffect(() => {
    if (!fileIndex || parsedTargets.length === 0) {
      setHeuristicStats({ count: 0, bytes: 0 });
      return;
    }

    let count = 0;
    let bytes = 0;

    for (const target of parsedTargets) {
      const entry = fileIndex.get(target.path);
      if (entry) {
        count++;
        // Size Heuristic: Summaries consist of high-density docblocks/types.
        // We estimate them at 15% of original or 600 bytes.
        if (target.resolution === 'summary') {
          bytes += Math.min(entry.size * 0.15, 600);
        } else {
          bytes += entry.size;
        }
      }
    }

    setHeuristicStats({ count, bytes });
  }, [fileIndex, parsedTargets]);

  /**
   * Orchestrates the string representation of the token count.
   * Logic: Accurate Count (if ready) > Heuristic + Loading (if assembling) > Heuristic.
   */
  const approxTokens = useMemo(() => {
    // If the worker is done and we have an accurate count, use it.
    // If isAssembling is true, the count is stale/outdated, so we ignore it.
    if (accurateTokenCount !== null && !isAssembling) {
      return accurateTokenCount.toLocaleString();
    }
    
    // Calculate the fast fallback
    const baseProseEstimate = heuristicStats.bytes / 4;
    const calibratedEstimate = Math.round(baseProseEstimate * CODE_SAFETY_FACTOR);
    const label = `~${calibratedEstimate.toLocaleString()}`;

    // Add visual indicator if the background job is running
    return isAssembling ? `${label}...` : label;
  }, [heuristicStats.bytes, accurateTokenCount, isAssembling]);

  return {
    selectedCount: heuristicStats.count,
    selectedBytes: heuristicStats.bytes,
    approxTokens,
    /** UI flag to indicate if we are showing the final truth or a guess */
    isAccurate: accurateTokenCount !== null && !isAssembling,
    /** Expose background status for optional spinner/loading logic */
    isCalculating: isAssembling
  };
}