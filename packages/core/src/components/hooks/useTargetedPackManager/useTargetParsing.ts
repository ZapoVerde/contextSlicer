/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/useTargetParsing.ts
 * @stamp {"ts":"2026-02-15T11:05:00Z"}
 * @architectural-role Custom Hook / Logic
 * @description
 * Responsible for transforming the raw, comma-separated user input string into 
 * a structured array of TargetedPath objects. Handles path cleaning and 
 * resolution mode detection (e.g., path/to/file:summary).
 * 
 * @core-principles
 * 1. OWNS the logic for interpreting the targeted paths DSL.
 * 2. MUST provide a memoized result to prevent downstream re-calculations.
 * 3. IS NOT responsible for file existence verification.
 * 
 * @contract
 *   assertions:
 *     purity: pure-function-wrapper
 *     state_ownership: none
 *     external_io: none
 */

import { useMemo } from 'react';
import type { TargetedPath } from './types';

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/useTargetParsing.ts#useTargetParsing
 * @description
 * Parses a comma-separated string of paths. Supports the ":summary" suffix 
 * to flag specific files for architectural distillation instead of full 
 * implementation extraction.
 * 
 * @param targetedPathsInput - The raw string from the user input/store.
 */
export function useTargetParsing(targetedPathsInput: string) {
  const parsedTargets = useMemo((): TargetedPath[] => {
    return targetedPathsInput
      .split(',')
      .map((s) => {
        const trimmed = s.trim();
        if (!trimmed) return null;

        const parts = trimmed.split(':');
        // Handle paths that might contain colons (unlikely in this context, 
        // but we assume the last part is the resolution flag).
        if (parts.length > 1 && parts[parts.length - 1] === 'summary') {
          const path = parts.slice(0, -1).join(':');
          return { path, resolution: 'summary' as const };
        }

        return { path: trimmed, resolution: 'full' as const };
      })
      .filter((t): t is TargetedPath => t !== null);
  }, [targetedPathsInput]);

  return { parsedTargets };
}