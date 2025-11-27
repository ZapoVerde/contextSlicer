/**
 * @file packages/core/src/state/slicer-loader.ts
 * @stamp 2025-11-24T16:35:00Z
 * @architectural-role State Management
 * @description
 * Implements the loading and persistence logic for the SlicerStore.
 *
 * @core-principles
 * 1. ORCHESTRATES the data loading lifecycle (Config -> Files -> Graph).
 * 2. DELEGATES actual data retrieval and persistence to the injected FileSource.
 * 3. ENFORCES state transitions (loading -> ready/error).
 *
 * @contract
 *   assertions:
 *     purity: mutates
 *     state_ownership: [status, error, source, activeAdapter, slicerConfig, fileIndex]
 *     external_io: none # Delegates to adapter
 */

import type { StateCreator } from 'zustand';
import type { SlicerState, FileEntry, SourceType, SlicerConfig } from './slicer-state';
import type { FileSource } from '../types/fileSource';

export interface LoaderSlice {
  setFileSource: (source: FileSource, sourceType: SourceType) => Promise<void>;
  updateConfig: (newConfig: SlicerConfig) => Promise<void>;
  reset: () => void;
}

export const createLoaderSlice: StateCreator<SlicerState, [], [], LoaderSlice> = (set, get) => ({
  reset: () => {
    set({ status: 'idle', error: null, fileIndex: null, symbolGraph: null, activeAdapter: null });
  },

  setFileSource: async (source: FileSource, sourceType: SourceType) => {
    set({ status: 'loading', error: null, source: sourceType, activeAdapter: source });

    try {
      const config = await source.getConfig();
      const fileList = await source.getFileList();
      
      const fileIndex = new Map<string, FileEntry>();
      for (const meta of fileList) {
        fileIndex.set(meta.path, {
          path: meta.path,
          size: meta.size,
          getText: () => source.getFileContent(meta.path),
          getUint8: () => source.getFileBuffer(meta.path),
        });
      }

      set({
        slicerConfig: config,
        fileIndex,
        status: 'ready',
        symbolGraph: null,
        graphStatus: 'idle',
        resolutionErrors: []
      });

      get().ensureSymbolGraph();

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown loading error';
      console.error('[Loader] Failed to load source:', error);
      set({ status: 'error', error: msg });
    }
  },

  updateConfig: async (newConfig: SlicerConfig) => {
    const { activeAdapter } = get();
    
    // 1. Optimistic update
    set({ slicerConfig: newConfig });

    // 2. Persist if possible
    if (activeAdapter) {
      try {
        await activeAdapter.saveConfig(newConfig);
        console.log('[Loader] Config persisted successfully.');
        
        // 3. Refresh file list if sanitation rules changed
        // For simplicity, we trigger a full reload to re-run the scanner/zip-filter
        await get().setFileSource(activeAdapter, get().source);
        
      } catch (e) {
        console.error('[Loader] Failed to save config:', e);
        // Note: We keep the optimistic update for now, but ideally we'd rollback on error.
      }
    }
  }
});