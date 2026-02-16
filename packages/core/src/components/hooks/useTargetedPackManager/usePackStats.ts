/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/usePackStats.ts
 * @stamp {"ts":"2026-02-16T13:50:00Z"}
 * @architectural-role Custom Hook / Logic
 * @description
 * Calculates real-time statistics for the current selection of targeted paths.
 * Implements "Progressive Accuracy":
 * 1. Synchronous: Provides a Code-calibrated heuristic (1.6x) for instant feedback.
 * 2. Asynchronous: Performs actual Tiktoken BPE analysis in the background once 
 *    file contents are fetched.
 * 
 * @core-principles
 * 1. OWNS the logic for context pack size estimation.
 * 2. ENFORCES accuracy by transitioning from heuristic to actual BPE counting.
 * 3. MUST NOT block the UI thread during heavy tokenization.
 * 
 * @contract
 *   assertions:
 *     purity: mutates # Managed via useEffect/useState.
 *     state_ownership: [selectedCount, selectedBytes, accurateCount, isCalculating]
 *     external_io: none
 */

import { useState, useEffect, useMemo } from 'react';
import type { FileEntry } from '../../../state/slicer-state';
import { countTokens } from '../../../logic/tokenCounter';
import type { TargetedPath } from './types';

const CODE_SAFETY_FACTOR = 1.6;

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/usePackStats.ts#usePackStats
 * @description
 * Orchestrates the dual-layer token counting logic.
 */
export function usePackStats(
  fileIndex: Map<string, FileEntry> | null,
  parsedTargets: TargetedPath[]
) {
  // Layer 1: Heuristic State (Fast)
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const [selectedBytes, setSelectedBytes] = useState<number>(0);

  // Layer 2: Accuracy State (Slow/Async)
  const [accurateCount, setAccurateCount] = useState<number | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // --- LAYER 1: HEURISTIC (Synchronous) ---
  useEffect(() => {
    if (!fileIndex || parsedTargets.length === 0) {
      setSelectedCount(0);
      setSelectedBytes(0);
      setAccurateCount(null);
      return;
    }

    let count = 0;
    let bytes = 0;

    for (const target of parsedTargets) {
      const entry = fileIndex.get(target.path);
      if (entry) {
        count++;
        // Rough byte estimation including summary reduction
        if (target.resolution === 'summary') {
          bytes += Math.min(entry.size * 0.15, 600);
        } else {
          bytes += entry.size;
        }
      }
    }

    setSelectedCount(count);
    setSelectedBytes(bytes);
    // Reset accurate count whenever the selection changes to trigger recalculation
    setAccurateCount(null);
  }, [fileIndex, parsedTargets]);

  // --- LAYER 2: TIKTOKEN (Asynchronous) ---
  useEffect(() => {
    if (!fileIndex || parsedTargets.length === 0) return;

    let isAborted = false;
    const timer = setTimeout(async () => {
      setIsCalculating(true);
      try {
        // 1. Gather all contents (Parallel Async Load)
        const fetchTasks = parsedTargets.map(async (t) => {
          const entry = fileIndex.get(t.path);
          if (!entry) return '';
          const text = await entry.getText();
          
          // Mimic the actual output structure to get accurate counting
          if (t.resolution === 'summary') {
             // Summaries are significantly shorter, we use a placeholder 
             // length for the distilled brief
             return `=== ${t.path} ===\n[SUMMARY]\n${text.substring(0, 500)}`;
          }
          return `=== ${t.path} ===\n${text}`;
        });

        const contents = await Promise.all(fetchTasks);
        if (isAborted) return;

        // 2. Run actual BPE Tokenizer
        const totalAssembledText = contents.join('\n');
        const count = countTokens(totalAssembledText);

        if (!isAborted) {
          setAccurateCount(count);
        }
      } catch (e) {
        console.error('[usePackStats] Tiktoken calculation failed', e);
      } finally {
        if (!isAborted) setIsCalculating(false);
      }
    }, 500); // Debounce to prevent heavy tokenizing while typing

    return () => {
      isAborted = true;
      clearTimeout(timer);
    };
  }, [fileIndex, parsedTargets]);

  /**
   * Derived formatting for the UI.
   * Prioritizes the accurateCount if available, falls back to heuristic.
   */
  const approxTokens = useMemo(() => {
    if (accurateCount !== null) {
      return `${accurateCount.toLocaleString()}`;
    }
    
    // Fallback to safety-factored heuristic
    const baseProseEstimate = selectedBytes / 4;
    const calibratedEstimate = Math.round(baseProseEstimate * CODE_SAFETY_FACTOR);
    
    return `~${calibratedEstimate.toLocaleString()}${isCalculating ? '...' : ''}`;
  }, [selectedBytes, accurateCount, isCalculating]);

  return {
    selectedCount,
    selectedBytes,
    approxTokens,
    isAccurate: accurateCount !== null
  };
}