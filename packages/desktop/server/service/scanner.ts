/**
 * @file packages/desktop/server/service/scanner.ts
 * @stamp {"ts":"2025-11-28T10:20:00Z"}
 * @architectural-role Service Logic
 * @description
 * The core file system traversal engine. It recursively scans the target repository
 * based on the provided configuration. It enforces a strict "Safety Brake" to prevent
 * runaway scans and relies entirely on the configuration for exclusion rules,
 * explicitly ignoring any .gitignore files present on disk.
 *
 * @core-principles
 * 1. IS the engine for file discovery and metadata extraction.
 * 2. MUST strictly adhere to the provided `AppConfig` without implicit behaviors.
 * 3. ENFORCES safety limits to protect the runtime environment from memory exhaustion.
 *
 * @api-declaration
 *   export interface FileNode { path: string; size: number; }
 *   export interface ScanResult { files: FileNode[]; error?: string; }
 *   export function scanRepository(config: AppConfig): ScanResult;
 *
 * @contract
 *   assertions:
 *     purity: read-only # Reads file system state, does not modify it.
 *     state_ownership: none
 *     external_io: fs # Heavy read operations on the local filesystem.
 */

import fs from 'fs';
import path from 'path';
import ignore from 'ignore';
import type { AppConfig } from '../config.js';

export interface FileNode {
  path: string;
  size: number;
}

export interface ScanResult {
  files: FileNode[];
  error?: string;
}

// Safety Brake: Stop scanning if we hit this many files.
// This prevents infinite loops (symlinks) or massive node_modules scans 
// if the user accidentally un-configures the exclusions.
const MAX_FILE_SCAN_LIMIT = 50000;

/**
 * Scans the file system starting from config.repoRoot.
 * Filters files based on config.sanitation.denyPatterns.
 */
export function scanRepository(config: AppConfig): ScanResult {
  const results: FileNode[] = [];
  
  // Initialize the ignore engine with patterns from the config.
  // We strictly cast to 'any' here to handle potential ESM/CJS interop issues 
  // with the 'ignore' library in the bundled executable environment.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ig = (ignore as any)().add(config.sanitation.denyPatterns);
  
  let totalScanned = 0;
  let aborted = false;

  function walk(dir: string) {
    if (aborted) return;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      console.warn(`[Scanner] Failed to read directory: ${dir}`, e);
      return;
    }

    for (const entry of entries) {
      // 1. Safety Check
      if (totalScanned >= MAX_FILE_SCAN_LIMIT) {
        aborted = true;
        return;
      }
      totalScanned++;

      const fullPath = path.join(dir, entry.name);
      
      // 2. Path Resolution
      // We calculate the path relative to the REPO ROOT (the scan target),
      // not the CWD (where the executable runs).
      const relPath = path.relative(config.repoRoot, fullPath);

      // 3. Exclusion Logic
      // Note: The 'ignore' package expects relative paths.
      // We explicitly append '/' to directory names to ensure strict directory matching
      // (e.g. distinguishing 'build' folder from 'build.ts' file if patterns are vague).
      const checkPath = entry.isDirectory() ? relPath + '/' : relPath;
      
      // Skip if matched by denyPatterns.
      // We check 'relPath' existence to avoid filtering the root itself (empty string).
      if (relPath && ig.ignores(checkPath)) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        
        // 4. Hard Limits
        // Skip individual huge files immediately (e.g. >10MB) to save memory/tokens.
        if (stats.size > 10 * 1024 * 1024) continue;

        results.push({
          path: relPath,
          size: stats.size
        });
      }
    }
  }

  console.time('Scan');
  
  if (fs.existsSync(config.repoRoot)) {
      const rootStats = fs.statSync(config.repoRoot);
      if (rootStats.isDirectory()) {
          walk(config.repoRoot);
      } else {
          return { files: [], error: `Target path is not a directory: ${config.repoRoot}` };
      }
  } else {
      return { files: [], error: `Target directory not found: ${config.repoRoot}` };
  }
  
  console.timeEnd('Scan');
  
  if (aborted) {
    return { 
      files: results, 
      error: `Scan limit reached (${MAX_FILE_SCAN_LIMIT} files). The scan was stopped early. Please check your exclusion rules (e.g., ensure 'node_modules' is excluded).` 
    };
  }

  return { files: results };
}