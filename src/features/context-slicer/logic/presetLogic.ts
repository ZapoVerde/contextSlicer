/**
 * @file src/features/context-slicer/logic/presetLogic.ts
 * @architectural-role Logic Module / Preset Definitions
 *
 * @description This module encapsulates the logic for curated, one-click presets.
 * Each preset is defined by a hardcoded list of wildcard patterns that target a
 * conceptual group of files (e.g., "Environment", "State Management").
 * This approach is modular and easily extensible for future presets.
 */

import type { FileEntry } from '../state/zip-state';
import { wildcardToRegExp } from './wildcardUtils';

/**
 * A curated list of wildcard patterns that define what constitutes an
 * "environment file" for this specific project. This is the "Funnel".
 */
const ENVIRONMENT_PRESET_PATTERNS: string[] = [
  // --- Root Level Configs ---
  '.firebaserc',
  'cors.json',
  'firestore.indexes.json',
  'pnpm-workspace.yaml', // Assuming PNPM from repo structure
  'shell.nix',
  
  // --- Tooling Configs (Repo-wide) ---
  '**/*eslint*',      // Catches .eslintrc.js, eslint.config.js, etc.
  '**/*vite.config.*', // Catches vite.config.ts, vite.config.js
  '**/*vitest.config.*',// Catches vitest.config.ts, etc.
  '**/.npmrc',

  // --- Monorepo Structure ---
  '**/package.json',   // Root and all workspace package.json files
  '**/tsconfig*.json', // Root tsconfig, base, node, and all workspace configs

  // --- Developer Environment ---
  '.devcontainer/devcontainer.json',
  '.idx/dev.nix',
];

// --- START OF CHANGE (1/1): Add a specific exclusion list ---
/**
 * A list of file endings to explicitly exclude from the preset results.
 * This acts as the "Sieve".
 */
const PRESET_EXCLUSION_PATTERNS: string[] = [
    'pnpm-lock.yaml',
    'package-lock.json',
];


/**
 * Gathers all file paths that match the Environment Preset patterns.
 *
 * @param fileIndex The main file index from the zip store.
 * @returns A de-duplicated array of all matching file paths.
 */
export function getFilesForEnvironmentPreset(
  fileIndex: Map<string, FileEntry> | null
): string[] {
  if (!fileIndex) {
    return [];
  }

  const allFilePaths = Array.from(fileIndex.keys());
  const resultSet = new Set<string>();

  const regexes = ENVIRONMENT_PRESET_PATTERNS.map(wildcardToRegExp);

  // --- Funnel Step: Gather all potential matches ---
  for (const path of allFilePaths) {
    if (regexes.some(regex => regex.test(path))) {
      resultSet.add(path);
    }
  }

  // --- Sieve Step: Filter out the exclusions ---
  const finalResults = Array.from(resultSet).filter(path => 
    !PRESET_EXCLUSION_PATTERNS.some(exclusion => path.endsWith(exclusion))
  );

  return finalResults.sort();
}