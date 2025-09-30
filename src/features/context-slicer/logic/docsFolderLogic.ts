/**
 * @file src/features/context-slicer/logic/docsFolderLogic.ts
 * @architectural-role Logic Module / Feature Plugin
 *
 * @description This module encapsulates all the non-React business logic for the
 * "Dynamic Docs Folder Inclusion" feature. It acts as a self-contained "plugin"
 * that can be consumed by the main state hook.
 *
 * @responsibilities
 * 1.  **Discovery:** Provides a pure function to scan a `fileIndex` and discover
 *     all unique, top-level subdirectories within a `docs/` folder.
 * 2.  **File Gathering:** Provides a pure function that, given a set of "checked"
 *     folder names, returns a flat list of all file paths within those folders.
 *
 * @core-principles
 * - **Modularity:** This file is completely decoupled from React and the UI.
 * - **Purity:** All functions are pure; they take inputs and return outputs with
 *   no side effects.
 * - **Testability:** The decoupling makes these functions easy to unit test.
 */

import type { FileEntry } from '../state/zip-state';

/**
 * Scans the file index and returns a unique, sorted list of top-level
 * directories found within the 'docs/' directory.
 *
 * @param fileIndex The main file index from the zip store.
 * @returns A sorted array of folder names (e.g., ['architecture', 'guide']).
 */
export function discoverDocsFolders(fileIndex: Map<string, FileEntry> | null): string[] {
    if (!fileIndex) {
      return [];
    }
  
    const folderSet = new Set<string>();
  
    for (const path of fileIndex.keys()) {
      // We only care about paths that are inside the 'docs' directory.
      if (path.startsWith('docs/')) {

        // --- PASTE SNIPPET HERE ---
        folderSet.add('docs'); // Add the root 'docs' folder itself

        const parts = path.split('/');
        // A path like 'docs/architecture/file.md' has 3 parts.
        // We are interested in the second part ('architecture'), which represents a sub-folder.
        // To be a sub-folder, there must be at least one more part after it (the file).
        // Therefore, the path must have more than 2 parts.
        if (parts.length > 2 && parts[1]) {
          folderSet.add(parts[1]);
        }
      }
    }
  
    return Array.from(folderSet).sort();
  }

/**
 * Gathers all file paths that belong to the user-selected "checked" folders.
 *
 * @param fileIndex The main file index from the zip store.
 * @param checkedFolders An object representing the state of the checkboxes,
 *                       e.g., { architecture: true, workflow: false }.
 * @returns A flat array of all file paths to be included.
 */
// ----- REPLACE THIS ENTIRE FUNCTION -----

export function getFilesForCheckedFolders(
    fileIndex: Map<string, FileEntry> | null,
    checkedFolders: Record<string, boolean>
  ): string[] {
    if (!fileIndex) {
      return [];
    }
  
    const includedFiles: string[] = [];
    const activeFolders = Object.entries(checkedFolders)
      .filter(([, isChecked]) => isChecked)
      .map(([folderName]) => folderName);
  
    if (activeFolders.length === 0) {
      return [];
    }
  
    // This logic now correctly handles the 'docs' folder itself.
    const folderPrefixes = activeFolders.map(name => {
      if (name === 'docs') {
        return 'docs/'; // For the 'docs' checkbox, the prefix is just 'docs/'
      }
      return `docs/${name}/`; // For sub-folder checkboxes, it's 'docs/subfolder/'
    });
  
    for (const path of fileIndex.keys()) {
      if (folderPrefixes.some(prefix => path.startsWith(prefix))) {
        includedFiles.push(path);
      }
    }
  
    return includedFiles;
  }