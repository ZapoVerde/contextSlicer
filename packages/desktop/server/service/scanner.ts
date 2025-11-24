/**
 * @file packages/desktop/server/service/scanner.ts
 * @stamp 2025-11-24T12:10:00Z
 * @architectural-role Service Logic
 * @description
 * Scans the filesystem to produce a flat list of files.
 */

import fs from 'fs';
import path from 'path';
import ignore from 'ignore';
import { CONFIG } from '../config.js';

const ig = (ignore as any)().add(CONFIG.sanitation.denyPatterns);

export interface FileNode {
  path: string;
  size: number;
}

export function scanRepository(): FileNode[] {
  const results: FileNode[] = [];
  
  function walk(dir: string) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      console.warn(`[Scanner] Failed to read ${dir}`);
      return;
    }

    for (const entry of entries) {
      // Basic sanity checks
      if (entry.name.startsWith('.')) continue; // Skip dotfiles/folders by default for speed? Or strict gitignore?
      
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(CONFIG.repoRoot, fullPath);

      // Check Ignore Rules
      if (ig.ignores(relPath)) continue;

      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        // Skip huge files immediately (e.g. 10MB+)
        if (stats.size > 10 * 1024 * 1024) continue;

        results.push({
          path: relPath, // Clients want relative paths (e.g. "src/main.ts")
          size: stats.size
        });
      }
    }
  }

  console.time('Scan');
  walk(CONFIG.repoRoot);
  console.timeEnd('Scan');
  
  return results;
}