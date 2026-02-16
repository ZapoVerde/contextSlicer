/**
 * @file packages/desktop/server/service/scanner.ts
 * @stamp {"ts":"2026-02-16T22:00:00Z"}
 * @architectural-role Service Logic
 * @description
 * The core file system traversal engine. Refactored to support "Bulk Loading,"
 * allowing the server to package the entire relevant source code into a single
 * payload to eliminate network chatter.
 *
 * @core-principles
 * 1. IS the engine for file discovery and content extraction.
 * 2. MUST strictly adhere to the provided `AppConfig` exclusions.
 * 3. ENFORCES binary file filtering to prevent payload bloat.
 *
 * @contract
 *   assertions:
 *     purity: read-only
 *     external_io: fs
 */

import fs from 'fs/promises';
import path from 'path';
import ignore from 'ignore';
import { isText } from 'istextorbinary';
import type { AppConfig } from '../config.js';

export interface FileNode {
  path: string;
  size: number;
}

export interface ScanResult {
  files: FileNode[];
  error?: string;
}

export interface BulkContentResult {
  files: Record<string, string>;
  error?: string;
}

// Safety Brake
const MAX_FILE_SCAN_LIMIT = 50000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Scans the file system and returns metadata only.
 */
export async function scanRepository(config: AppConfig): Promise<ScanResult> {
  // Reuse the logic via a flag, or keep separate to avoid overhead if not needed.
  // For now, we keep the original scanner logic but optimized.
  
  const results: FileNode[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ig = (ignore as any)().add(config.sanitation.denyPatterns);
  
  const acceptedExts = config.sanitation.acceptedExtensions 
    ? new Set(config.sanitation.acceptedExtensions.map(ext => ext.toLowerCase().replace(/^\./, '')))
    : null;

  let totalScanned = 0;
  let aborted = false;

  const walk = async (dir: string): Promise<void> => {
    if (aborted) return;

    let entries: import('fs').Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    const promises = entries.map(async (entry) => {
      if (aborted) return;
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(config.repoRoot, fullPath).replace(/\\/g, '/'); // Normalize slashes
      
      const checkPath = entry.isDirectory() ? relPath + '/' : relPath;
      if (relPath && ig.ignores(checkPath)) return;

      if (totalScanned >= MAX_FILE_SCAN_LIMIT) {
        aborted = true;
        return;
      }
      totalScanned++;

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (acceptedExts) {
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          if (!ext || !acceptedExts.has(ext)) return;
        }

        try {
          const stats = await fs.stat(fullPath);
          if (stats.size > MAX_FILE_SIZE) return;
          results.push({ path: relPath, size: stats.size });
        } catch { /* ignore */ }
      }
    });

    await Promise.all(promises);
  };

  try {
    await walk(config.repoRoot);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { files: [], error: msg };
  }

  if (aborted) {
    return { files: results, error: 'Scan limit reached.' };
  }

  return { files: results };
}

/**
 * Scans the repository and returns the TEXT content of all valid files.
 * This effectively "Zips" the repo into a JSON object for the client.
 */
export async function readRepositoryContent(config: AppConfig): Promise<BulkContentResult> {
  const contentMap: Record<string, string> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ig = (ignore as any)().add(config.sanitation.denyPatterns);

  const acceptedExts = config.sanitation.acceptedExtensions 
    ? new Set(config.sanitation.acceptedExtensions.map(ext => ext.toLowerCase().replace(/^\./, '')))
    : null;

  let totalScanned = 0;
  let aborted = false;

  const walk = async (dir: string): Promise<void> => {
    if (aborted) return;

    let entries: import('fs').Dirent[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch { return; }

    const promises = entries.map(async (entry) => {
      if (aborted) return;
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(config.repoRoot, fullPath).replace(/\\/g, '/');
      
      const checkPath = entry.isDirectory() ? relPath + '/' : relPath;
      if (relPath && ig.ignores(checkPath)) return;

      if (totalScanned >= MAX_FILE_SCAN_LIMIT) {
        aborted = true;
        return;
      }
      totalScanned++;

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        // Extension Check
        if (acceptedExts) {
          const ext = path.extname(entry.name).toLowerCase().replace('.', '');
          if (!ext || !acceptedExts.has(ext)) return;
        }

        try {
          // Read Buffer
          const buffer = await fs.readFile(fullPath);
          
          // Binary Check (Optimization: Don't send images/binaries in bulk JSON)
          if (buffer.length > MAX_FILE_SIZE) return;
          
          // isText returns true, false, or null (undetermined). We accept true.
          if (isText(fullPath, buffer) === true) {
            contentMap[relPath] = buffer.toString('utf-8');
          }
        } catch { /* ignore read errors */ }
      }
    });

    await Promise.all(promises);
  };

  try {
    await walk(config.repoRoot);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { files: {}, error: msg };
  }

  return { files: contentMap };
}