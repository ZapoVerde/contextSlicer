/**
 * @file packages/core/src/state/slicer-graph-manager.ts
 * @stamp {"ts":"2025-11-24T07:00:00Z"}
 * @architectural-role State Management
 *
 * @description
 * This store slice encapsulates the logic for building and managing the Symbol
 * Dependency Graph. It acts as the bridge between the raw file index and the
 * complex AST analysis logic.
 *
 * @core-principles
 * 1. OWNS the lifecycle of the symbol graph generation (idle -> building -> ready).
 * 2. DELEGATES the heavy computational AST parsing to the `buildSymbolGraph` utility.
 * 3. MUST ONLY trigger a build if the file index is fully loaded and valid.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Updates the global store state.
 *     state_ownership: [symbolGraph, graphStatus, resolutionErrors]
 *     external_io: none # Logic is computational; data comes from memory.
 */

import type { StateCreator } from 'zustand';
import type { SlicerState } from './slicer-state';
import { buildSymbolGraph, type SymbolGraph } from '../logic/symbolGraph'; 

export interface GraphSlice {
  symbolGraph: SymbolGraph | null;
  graphStatus: 'idle' | 'building' | 'ready' | 'error';
  ensureSymbolGraph: () => Promise<void>;
}

export const createGraphSlice: StateCreator<SlicerState, [], [], GraphSlice> = (set, get) => ({
  symbolGraph: null,
  graphStatus: 'idle',

  ensureSymbolGraph: async () => {
    const { graphStatus, fileIndex } = get();
    
    // Prevent re-entry or running without data
    if (graphStatus === 'building' || (graphStatus === 'ready' && get().symbolGraph) || !fileIndex) {
      return;
    }
    
    set({ graphStatus: 'building', resolutionErrors: [] });
    
    try {
      console.log('[SymbolGraph] Starting to build symbol graph...');
      const startTime = performance.now();
      const errors: string[] = [];
      
      // The logic layer expects a map of FileEntries and an alias map.
      // TODO: In Phase 3, extract aliasMap from SlicerConfig if available.
      const graph = await buildSymbolGraph(fileIndex, {}, errors); 
      
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
  },
});