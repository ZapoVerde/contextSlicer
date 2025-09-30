/**
 * @file packages/context-slicer-app/scripts/build-step-collect-files.ts
 * @architectural-role Build Step / Data Collection
 *
 * @description This module is responsible for finding all relevant source files in the repository that should be included in the dump. It uses the configured ignore rules to filter out unwanted files and then provides a utility to group the collected files by their parent directories.
 *
 * @core-principles
 * 1. **MUST** correctly traverse the project's file tree starting from the repository root.
 * 2. **MUST** use the `walkDir` utility, which respects the ignore rules, to identify files.
 * 3. **MUST** return a flat list of file objects, each containing its relative path and size.
 * 4. **MUST** provide a separate function to transform the flat list into a structure grouped by parent folders.
 */

import fs from 'fs';
import path from 'path';
import * as config from './config.ts';
import { walkDir } from './file-utils.ts';

// Define a clear type for the file objects we're working with.
export interface SourceFile {
  path: string;
  bytes: number;
}

/**
 * Walks the repository directory to find all files that are not excluded by the ignore rules.
 * @returns {SourceFile[]} An array of file objects.
 */
export function collectSourceFiles(): SourceFile[] {
  const collected: SourceFile[] = [];

  walkDir(config.REPO_ROOT, (fullPath: string, isDir: boolean) => {
    // We only care about files, not directories.
    if (!isDir) {
      const relPath: string = path.relative(config.REPO_ROOT, fullPath).replace(/\\/g, '/');
      const stats: fs.Stats = fs.statSync(fullPath);
      collected.push({ path: relPath, bytes: stats.size });
    }
  });

  // Sort the final list for consistent ordering in concatenated files.
  collected.sort((a, b) => a.path.localeCompare(b.path));

  return collected;
}

/**
 * Groups a flat list of file entries by their parent directories.
 * A file in 'a/b/c.txt' will be included in the group for 'a' and the group for 'a/b'.
 * @param {SourceFile[]} files - The flat list of collected files.
 * @returns {Map<string, SourceFile[]>} A map where keys are folder paths
 * and values are arrays of file objects belonging to that folder and its subfolders.
 */
export function groupFilesByFolder(files: SourceFile[]): Map<string, SourceFile[]> {
  const map = new Map<string, SourceFile[]>();

  // Helper to add a file to a group, creating the group if it doesn't exist.
  const add = (folderKey: string, file: SourceFile): void => {
    if (!map.has(folderKey)) {
      map.set(folderKey, []);
    }
    map.get(folderKey)!.push(file);
  };

  for (const file of files) {
    const parts: string[] = file.path.split('/');

    // If the file is in the root, it belongs to the special '(repo root)' group.
    if (parts.length === 1) {
      add('', file); // Use empty string as the key for the repo root.
      continue;
    }

    // For a file 'a/b/c.js', add it to the group for 'a' and the group for 'a/b'.
    for (let i = 1; i < parts.length; i++) {
      const folder: string = parts.slice(0, i).join('/');
      add(folder, file);
    }
  }

  // Ensure files within each group are sorted alphabetically for consistent output.
  for (const arr of map.values()) {
    arr.sort((a, b) => a.path.localeCompare(b.path));
  }

  return map;
}