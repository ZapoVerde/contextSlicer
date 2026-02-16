/**
 * @file packages/core/src/state/slicer-graph-manager.ts
 * @stamp {"ts":"2026-02-16T16:50:00Z"}
 * @architectural-role State Management
 * @description
 * Manages the lifecycle and state of the architectural Symbol Graph. 
 * Orchestrates background analysis via the WorkerPool and provides surgical 
 * patching capabilities for real-time filesystem synchronization.
 *
 * @core-principles
 * 1. STATE INTEGRITY: ENFORCES atomic updates to the Graph to prevent partial states.
 * 2. PERFORMANCE: MUST delegate heavy AST parsing to the WorkerPool.
 * 3. REACTIVITY: Provides real-time updates to the graph via differential patching.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Updates the global store state.
 *     state_ownership: [symbolGraph, graphStatus, workerPool, resolutionErrors]
 *     external_io: none
 */

import type { StateCreator } from 'zustand';
import type { SlicerState } from './slicer-state.js';
import { WorkerPool } from '../logic/worker/WorkerPool.js';
import { buildSymbolGraph, type SymbolGraph } from '../logic/symbolGraph/index.js';

/**
 * @id packages/core/src/state/slicer-graph-manager.ts#GraphSlice
 * @description
 * Definitive interface for the Graph Management store slice.
 */
export interface GraphSlice {
  /** The persistent worker pool used for parallel analysis */
  workerPool: WorkerPool | null;
  /** The processed code dependency graph */
  symbolGraph: SymbolGraph | null;
  /** The current health/readiness status of the graph */
  graphStatus: 'idle' | 'building' | 'ready' | 'error';
  /** Non-fatal errors encountered during analysis */
  resolutionErrors: string[];
  /** Triggers a full background build of the symbol graph */
  ensureSymbolGraph: () => Promise<void>;
  /** Surgically updates a single node in the graph when a file changes */
  patchGraphNode: (path: string) => Promise<void>;
}

export const createGraphSlice: StateCreator<SlicerState, [], [], GraphSlice> = (set, get) => ({
  workerPool: null,
  symbolGraph: null,
  graphStatus: 'idle',
  resolutionErrors: [],

  ensureSymbolGraph: async () => {
    const { graphStatus, fileIndex, slicerConfig } = get();
    
    // Prevent re-entry or running without necessary data
    if (graphStatus === 'building' || !fileIndex) {
      return;
    }
    
    // 1. Initialize Worker Pool if needed
    let pool = get().workerPool;
    if (!pool) {
      pool = new WorkerPool();
      await pool.init();
      set({ workerPool: pool });
    }

    set({ graphStatus: 'building', resolutionErrors: [] });
    
    try {
      console.log('[SymbolGraph] Starting parallel background build...');
      const startTime = performance.now();
      const errors: string[] = [];
      
      // Pass the worker pool to the orchestrator for parallel execution
      const graph = await buildSymbolGraph(
        fileIndex, 
        {}, // Alias map can be extracted from slicerConfig in future
        errors,
        pool
      ); 
      
      const duration = (performance.now() - startTime).toFixed(2);
      console.log(`[SymbolGraph] Build complete (${duration}ms). Nodes: ${graph.size}`);
      
      set({ 
        symbolGraph: graph, 
        graphStatus: 'ready', 
        resolutionErrors: errors 
      });
    } catch (e: unknown) {
      console.error('[SymbolGraph] Fatal build failure:', e);
      set({ 
        graphStatus: 'error',
        resolutionErrors: ['FATAL: Graph generation failed. Check worker logs.'],
      });
    }
  },

  patchGraphNode: async (path: string) => {
    const { symbolGraph, workerPool, fileIndex, graphStatus } = get();

    // Patching only occurs on ready graphs to maintain consistency
    if (graphStatus !== 'ready' || !symbolGraph || !workerPool || !fileIndex) {
      return;
    }

    const fileEntry = fileIndex.get(path);
    if (!fileEntry) return;

    try {
      const content = await fileEntry.getText();
      
      // 1. Analyze changed file in background
      const result = await workerPool.execute('ANALYZE_FILE', { path, content });
      
      if (result.payload) {
        const metadata = result.payload;
        
        // 2. Surgical immutable update
        const newGraph = new Map(symbolGraph);
        
        // Remove old symbols for this file path
        for (const [id, node] of newGraph.entries()) {
          if (node.filePath === path) {
            newGraph.delete(id);
          }
        }

        // Add file node
        newGraph.set(path, {
          id: path,
          filePath: path,
          symbolName: '(file)',
          dependencies: new Set(), // Re-linking handled in Pass 3 logic
          dependents: new Set()
        });

        // Add symbols
        metadata.symbols.forEach(name => {
          const id = `${path}#${name}`;
          newGraph.set(id, {
            id,
            filePath: path,
            symbolName: name,
            dependencies: new Set(),
            dependents: new Set()
          });
        });

        set({ symbolGraph: newGraph });
        console.log(`[SymbolGraph] Surgically patched: ${path}`);
      }
    } catch (e) {
      console.warn(`[SymbolGraph] Patch failed for ${path}:`, e);
    }
  }
});