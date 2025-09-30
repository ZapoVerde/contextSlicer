/**
 * @file packages/context-slicer-app/src/features/context-slicer/state/zip-graph-manager.ts
 * @stamp {"ts":"2025-09-29T00:15:10Z"}
 * @architectural-role State Management / Store Slice / Graph Logic
 *
 * @description
 * This module encapsulates all the logic for building and managing the Symbol
 * Dependency Graph. It isolates the expensive computation from other concerns and
 * ensures the graph is only built when needed (lazily).
 *
 * Its most critical role is to act as the bridge between the application's
 * loaded data (the manifest) and the graph generation engine. When a graph is
 * requested for the first time, this slice extracts the authoritative `aliasMap`
 * from the manifest in its state and passes it to the `buildSymbolGraph`
 * function, thereby kicking off the now fully-dynamic analysis process.
 *
 * @core-principles
 * 1.  IT MUST MANAGE THE GRAPH LIFECYCLE: It exclusively owns the `symbolGraph`
 *     state and its `graphStatus`, controlling the entire lifecycle from 'idle'
 *     to 'ready'.
 *
 * 2.  IT MUST BE LAZY: The graph construction is an expensive operation. This
 *     slice MUST only trigger the build on-demand via the `ensureSymbolGraph`
 *     action, preventing unnecessary computation on application load.
 *
 * 3.  IT IS THE DATA FLOW BRIDGE: This slice is the designated point of connection
 *     between the loaded manifest and the symbol graph logic. It is responsible
 *     for extracting the `aliasMap` and providing it to the graph builder.
 */
import type { StateCreator } from 'zustand';
import type { ZipState } from './zip-state';
import { buildSymbolGraph, type SymbolGraph } from '../logic/symbolGraph'; 

// --- Slice Definition ---

export interface GraphSlice {
  symbolGraph: SymbolGraph | null;
  graphStatus: 'idle' | 'building' | 'ready' | 'error';
  ensureSymbolGraph: () => Promise<void>;
}

export const createGraphSlice: StateCreator<ZipState, [], [], GraphSlice> = (set, get) => ({
  symbolGraph: null,
  graphStatus: 'idle',

  ensureSymbolGraph: async () => {
    // --- START OF DYNAMIC ALIAS INTEGRATION (State Manager) ---
    // The get() function allows us to read the current state of the store.
    const { graphStatus, fileIndex, manifest } = get();
    
    // Abort if a build is in progress, already complete, or if the necessary data isn't loaded.
    if (graphStatus === 'building' || (graphStatus === 'ready' && get().symbolGraph) || !fileIndex || !manifest) {
      return;
    }
    
    set({ graphStatus: 'building', resolutionErrors: [] });
    
    try {
      console.log('[SymbolGraph] Starting to build symbol graph...');
      const startTime = performance.now();
      
      // The `buildSymbolGraph` function is now called with the authoritative
      // aliasMap from the manifest. This is the final connection in the new architecture.
      const errors: string[] = []; // Create the collection for errors.
      const graph = await buildSymbolGraph(fileIndex, manifest.aliasMap, errors); 
      
      const endTime = performance.now();
      console.log(`[SymbolGraph] Graph built in ${(endTime - startTime).toFixed(2)}ms.`);
      
      set({ symbolGraph: graph, graphStatus: 'ready', resolutionErrors: errors });
    } catch (e: unknown) {
      console.error('[SymbolGraph] Failed to build symbol graph:', e);
      set({ 
        graphStatus: 'error',
        resolutionErrors: ['FATAL: Graph generation failed. See console for details.'],
      });
    }
    // --- END OF DYNAMIC ALIAS INTEGRATION (State Manager) ---
  },
});