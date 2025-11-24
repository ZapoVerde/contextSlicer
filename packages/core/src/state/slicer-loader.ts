/**
 * @file packages/core/src/state/slicer-loader.ts
 * @stamp 2025-11-24T06:10:00Z
 * @architectural-role State Management
 * @description
 * Implements the loading logic for the SlicerStore. It uses the abstract FileSource
 * to populate the file index and configuration, keeping the store platform-agnostic.
 * @core-principles
 * 1. ORCHESTRATES the data loading lifecycle (Config -> Files -> Graph).
 * 2. DELEGATES actual data retrieval to the injected FileSource.
 * 3. ENFORCES state transitions (loading -> ready/error).
 */

import type { StateCreator } from 'zustand';
import type { SlicerState, FileEntry, SourceType } from './slicer-state';
import type { FileSource } from '../types/fileSource';

export interface LoaderSlice {
  setFileSource: (source: FileSource, sourceType: SourceType) => Promise<void>;
  reset: () => void;
}

export const createLoaderSlice: StateCreator<SlicerState, [], [], LoaderSlice> = (set, get) => ({
  reset: () => {
    // Basic reset logic; platform specific re-initialization is handled by the platform app
    set({ status: 'idle', error: null, fileIndex: null, symbolGraph: null });
  },

  setFileSource: async (source: FileSource, sourceType: SourceType) => {
    set({ status: 'loading', error: null, source: sourceType });

    try {
      // 1. Load Configuration
      const config = await source.getConfig();
      
      // 2. Load File List (Metadata)
      const fileList = await source.getFileList();
      
      // 3. Construct the File Index (Lazy Loading)
      const fileIndex = new Map<string, FileEntry>();
      
      for (const meta of fileList) {
        fileIndex.set(meta.path, {
          path: meta.path,
          size: meta.size,
          // Closure captures the source instance for lazy fetching
          getText: () => source.getFileContent(meta.path),
          getUint8: () => source.getFileBuffer(meta.path),
        });
      }

      set({
        slicerConfig: config,
        fileIndex,
        status: 'ready',
        // Clear old graph data
        symbolGraph: null,
        graphStatus: 'idle',
        resolutionErrors: []
      });

      // 4. Auto-trigger graph build (optional, matches previous behavior)
      get().ensureSymbolGraph();

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown loading error';
      console.error('[Loader] Failed to load source:', error);
      set({ status: 'error', error: msg });
    }
  },
});