/**
 * @file packages/desktop/server/service/scanner.ts
 * @stamp {"ts":"2025-12-05T14:30:00Z"}
 * @architectural-role Service Logic
 *
 * @description
 * The core file system traversal engine. It recursively scans the target repository
 * based on the provided configuration. It has been refactored to use asynchronous,
 * non-blocking I/O (`fs/promises`) and concurrent directory processing to drastically
 * improve performance on local disk scans.
 *
 * @core-principles
 * 1. IS the engine for file discovery and metadata extraction.
 * 2. MUST strictly adhere to the provided `AppConfig` without implicit behaviors.
 * 3. ENFORCES safety limits to protect the runtime environment from memory exhaustion.
 *
 * @api-declaration
 *   export interface FileNode { path: string; size: number; }
 *   export interface ScanResult { files: FileNode[]; error?: string; }
 *   export function scanRepository(config: AppConfig): Promise<ScanResult>;
 *
 * @contract
 *   assertions:
 *     purity: read-only # Reads file system state, does not modify it.
 *     state_ownership: none
 *     external_io: fs # Heavy read operations on the local filesystem.
 */

import fs from 'fs/promises';
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
 * Filters files based on config.sanitation.denyPatterns and config.sanitation.acceptedExtensions.
 * @returns A promise that resolves to the ScanResult.
 */
export async function scanRepository(config: AppConfig): Promise<ScanResult> {
  const results: FileNode[] = [];
  
  // Initialize the ignore engine with patterns from the config.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ig = (ignore as any)().add(config.sanitation.denyPatterns);

  // Prepare the extension whitelist for efficient lookup
  const acceptedExts = config.sanitation.acceptedExtensions 
    ? new Set(config.sanitation.acceptedExtensions.map(ext => ext.toLowerCase().replace(/^\./, '')))
    : null;
  
  let totalScanned = 0;
  let aborted = false;
  
  // Hard limit for a single file size (10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const walk = async (dir: string): Promise<void> => {
    if (aborted) return;

    let entries: import('fs').Dirent[] = [];
    try {
      // ASYNC I/O: Use fs.promises.readdir to read directory entries concurrently
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (e) {
      console.warn(`[Scanner] Failed to read directory: ${dir}`, e);
      return;
    }
    
    // Concurrently process all entries in the directory
    const promises = entries.map(async (entry) => {
      // Non-blocking check for abortion status within the async operation
      if (aborted) return;
      
      const fullPath = path.join(dir, entry.name);
      
      // 2. Path Resolution
      const relPath = path.relative(config.repoRoot, fullPath);

      // 3. Exclusion Logic
      const checkPath = entry.isDirectory() ? relPath + '/' : relPath;
      
      // Skip if matched by denyPatterns.
      if (relPath && ig.ignores(checkPath)) return;

      // 4. Safety Check (Increment must be careful in concurrent code)
      if (totalScanned >= MAX_FILE_SCAN_LIMIT) {
        aborted = true;
        return;
      }
      totalScanned++;
      
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        
        // 5. Whitelist Logic (Extension Check)
        if (acceptedExts) {
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          if (!ext || !acceptedExts.has(ext)) return;
        }

        let stats: import('fs').Stats;
        try {
          // ASYNC I/O: Use fs.promises.stat to get file metadata non-blocking
          stats = await fs.stat(fullPath);
        } catch (e) {
          // If stat fails (e.g. broken symlink), just skip the file.
          return; 
        }

        // 6. Hard Limits
        if (stats.size > MAX_FILE_SIZE) return;

        results.push({
          path: relPath,
          size: stats.size
        });
      }
    });

    // Wait for all file/folder processing in this directory to complete
    await Promise.all(promises);
  };

  console.time('Scan');
  
  let rootStats: import('fs').Stats;
  try {
      // ASYNC I/O: Check root status
      rootStats = await fs.stat(config.repoRoot);
  } catch {
      return { files: [], error: `Target directory not found: ${config.repoRoot}` };
  }

  if (rootStats.isDirectory()) {
      await walk(config.repoRoot);
  } else {
      return { files: [], error: `Target path is not a directory: ${config.repoRoot}` };
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