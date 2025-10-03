/**
 * @file src/features/context-slicer/logic/presetLogic.ts
 * @stamp {"ts":"2025-10-03T01:30:00Z"}
 * @architectural-role Logic Module / Pure Function Engine
 *
 * @description
 * This module acts as a pure, stateless "engine" for applying preset rules. It
 * has been refactored to be completely configuration-driven. It no longer
 * contains any hardcoded preset definitions. Instead, its primary exported
 * function, `getFilesForPreset`, accepts a preset configuration object as an
 * argument and uses the rules within that object to filter a given file index.
 * This decouples the "what" (the rules in the config) from the "how" (the
 * filtering logic in this engine).
 *
 * @contract
 * - This module MUST NOT contain any hardcoded data related to specific presets.
 * - The exported function `getFilesForPreset` MUST be a pure function.
 */

import type { FileEntry, Preset } from '../state/zip-state';
import { wildcardToRegExp } from './wildcardUtils';

/**
 * Gathers all file paths that match the provided Preset's patterns and exclusions.
 * This function acts as a reusable "funnel and sieve" for any preset object.
 *
 * @param fileIndex The main file index from the zip store.
 * @param preset The specific Preset object containing the patterns and exclusions.
 * @returns A de-duplicated array of all matching file paths.
 */
export function getFilesForPreset(
  fileIndex: Map<string, FileEntry> | null,
  preset: Preset
): string[] {
  if (!fileIndex) {
    return [];
  }

  const allFilePaths = Array.from(fileIndex.keys());
  const resultSet = new Set<string>();

  // --- Funnel Step: Gather all files matching the inclusion patterns ---
  if (preset.patterns.length > 0) {
    const inclusionRegexes = preset.patterns.map(wildcardToRegExp);
    for (const path of allFilePaths) {
      // FIX: Corrected the logical error: Call .test() on 'regex' not 'inclusionRegexes'
      if (inclusionRegexes.some(regex => regex.test(path))) {
        resultSet.add(path);
      }
    }
  }
  
  // Start with the result set. If there were no patterns, this set is empty.
  let finalResults = Array.from(resultSet);

  // --- Sieve Step: Filter out the exclusions ---
  if (preset.exclusions.length > 0) {
    const exclusionRegexes = preset.exclusions.map(wildcardToRegExp);
    finalResults = finalResults.filter(path => 
      !exclusionRegexes.some(regex => regex.test(path))
    );
  }

  return finalResults.sort();
}