/**
 * @file packages/core/src/state/slicer-loader.ts
 * @stamp {"ts":"2026-02-16T17:15:00Z"}
 * @architectural-role State Management
 * @description
 * Implements the loading and persistence logic for the SlicerStore. Orchestrates
 * the transition from raw data sources to an indexed, graph-ready state. 
 * Now supports real-time synchronization via the "Push" architecture.
 *
 * @core-principles
 * 1. EVENT DRIVEN: MUST react to filesystem events for live sources.
 * 2. ORCHESTRATES the data loading lifecycle (Config -> Files -> Graph).
 * 3. ENFORCES state consistency during incremental updates.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Updates the global store state.
 *     state_ownership: [status, error, source, activeAdapter, slicerConfig, fileIndex]
 *     external_io: none # Delegates to the injected FileSource.
 */

import type { StateCreator } from 'zustand';
import type { SlicerState, FileEntry, SourceType, SlicerConfig } from './slicer-state.js';
import type { FileSource, FileEvent } from '../types/fileSource.js';

/**
 * @id packages/core/src/state/slicer-loader.ts#LoaderSlice
 * @description
 * Definitive interface for the Loader store slice.
 */
export interface LoaderSlice {
  /** Injects a data adapter and initializes the project indexing flow */
  setFileSource: (source: FileSource, sourceType: SourceType) => Promise<void>;
  /** Updates the active configuration and persists it to the adapter */
  updateConfig: (newConfig: SlicerConfig) => Promise<void>;
  /** Clears project state and returns the app to idle */
  reset: () => void;
}

export const createLoaderSlice: StateCreator<SlicerState, [], [], LoaderSlice> = (set, get) => ({
  reset: () => {
    set({ 
      status: 'idle', 
      error: null, 
      fileIndex: null, 
      symbolGraph: null, 
      activeAdapter: null,
      graphStatus: 'idle'
    });
  },

  setFileSource: async (source: FileSource, sourceType: SourceType) => {
    set({ status: 'loading', error: null, source: sourceType, activeAdapter: source });

    try {
      const config = await source.getConfig();
      const fileList = await source.getFileList();
      
      const fileIndex = new Map<string, FileEntry>();
      
      /**
       * Helper to wrap raw file metadata into a functional FileEntry.
       */
      const createEntry = (path: string, size: number): FileEntry => ({
        path,
        size,
        getText: () => source.getFileContent(path),
        getUint8: () => source.getFileBuffer(path),
      });

      for (const meta of fileList) {
        fileIndex.set(meta.path, createEntry(meta.path, meta.size));
      }

      // 1. Initialize State
      set({
        slicerConfig: config,
        fileIndex,
        status: 'ready',
        symbolGraph: null,
        graphStatus: 'idle',
        resolutionErrors: []
      });

      // 2. Subscribe to "Push" events if supported by the source
      if (source.onWatcherEvent) {
        console.log('[Loader] Subscribing to source watcher events.');
        source.onWatcherEvent(async (event: FileEvent) => {
          const currentIndex = get().fileIndex;
          if (!currentIndex) return;

          const newIndex = new Map(currentIndex);

          if (event.type === 'unlink') {
            newIndex.delete(event.path);
            console.log(`[Loader] File removed from index: ${event.path}`);
          } else {
            // Add or Change: We update the index entry
            // Note: We don't have the size in the event, so we assume 0 or 
            // trigger a HEAD/stat request if precision is needed for the preview.
            newIndex.set(event.path, createEntry(event.path, 0));
            console.log(`[Loader] File updated in index: ${event.path}`);
            
            // Trigger differential patch of the graph
            await get().patchGraphNode(event.path);
          }

          set({ fileIndex: newIndex });
        });
      }

      // 3. Kick off the initial graph build
      await get().ensureSymbolGraph();

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown loading error';
      console.error('[Loader] Failed to load project source:', error);
      set({ status: 'error', error: msg });
    }
  },

  updateConfig: async (newConfig: SlicerConfig) => {
    const { activeAdapter, source } = get();
    
    // 1. Optimistic local update
    set({ slicerConfig: newConfig });

    // 2. Persist to adapter
    if (activeAdapter) {
      try {
        await activeAdapter.saveConfig(newConfig);
        console.log('[Loader] Configuration saved to source adapter.');
        
        // 3. Re-initialize source to apply new sanitation rules (extensions/denylist)
        await get().setFileSource(activeAdapter, source);
        
      } catch (e) {
        console.error('[Loader] Failed to persist config:', e);
      }
    }
  }
});