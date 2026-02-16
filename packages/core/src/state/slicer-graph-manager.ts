/**
 * @file packages/core/src/state/slicer-graph-manager.ts
 * @stamp {"ts":"2026-02-16T15:55:00Z"}
 * @architectural-role State Management
 * @description
 * Manages the lifecycle of the architectural Symbol Graph and orchestrates 
 * off-thread Context Pack assembly. Optimized to support optimistic background 
 * jobs with automatic cancellation for stale requests.
 *
 * @core-principles
 * 1. PERFORMANCE: MUST delegate heavy assembly and tokenization to background workers.
 * 2. INTEGRITY: ENFORCES a "Last-Task-Wins" policy to prevent stale results.
 * 3. EFFICIENCY: Gathers only necessary file text for the assembly payload.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Updates global store state.
 *     state_ownership: [symbolGraph, accurateTokenCount, isAssembling, assembledPackText]
 *     external_io: none
 */

import type { StateCreator } from 'zustand';
import type { SlicerState } from './slicer-state.js';
import { WorkerPool } from '../logic/worker/WorkerPool.js';
import { buildSymbolGraph, type SymbolGraph } from '../logic/symbolGraph/index.js';

/**
 * Tracks the ID of the most recent assembly request to handle cancellation.
 */
let latestAssemblyRequestId: string | null = null;

/**
 * @id packages/core/src/state/slicer-graph-manager.ts#GraphSlice
 * @description
 * Definitive interface for the Graph Management and Background Assembly slice.
 */
export interface GraphSlice {
  workerPool: WorkerPool | null;
  symbolGraph: SymbolGraph | null;
  graphStatus: 'idle' | 'building' | 'ready' | 'error';
  resolutionErrors: string[];
  
  // Optimistic Results
  isAssembling: boolean;
  assembledPackText: string | null;
  accurateTokenCount: number | null;

  ensureSymbolGraph: () => Promise<void>;
  patchGraphNode: (path: string) => Promise<void>;
  orchestrateAssembly: (
    targets: Array<{ path: string; resolution: 'full' | 'summary' }>,
    options: { docblocksOnly: boolean; includeBoundaryLibrary: boolean }
  ) => Promise<void>;
}

export const createGraphSlice: StateCreator<SlicerState, [], [], GraphSlice> = (set, get) => ({
  workerPool: null,
  symbolGraph: null,
  graphStatus: 'idle',
  resolutionErrors: [],
  
  // Initial Optimistic State
  isAssembling: false,
  assembledPackText: null,
  accurateTokenCount: null,

  ensureSymbolGraph: async () => {
    const { graphStatus, fileIndex, symbolGraph } = get();
    if (graphStatus === 'building' || (graphStatus === 'ready' && symbolGraph) || !fileIndex) {
      return;
    }
    
    let pool = get().workerPool;
    if (!pool) {
      pool = new WorkerPool();
      await pool.init();
      set({ workerPool: pool });
    }

    set({ graphStatus: 'building', resolutionErrors: [] });
    
    try {
      const errors: string[] = [];
      const graph = await buildSymbolGraph(fileIndex, {}, errors, pool); 
      set({ symbolGraph: graph, graphStatus: 'ready', resolutionErrors: errors });
    } catch (e: unknown) {
      set({ 
        graphStatus: 'error',
        resolutionErrors: ['FATAL: Graph generation failed.'],
      });
    }
  },

  patchGraphNode: async (path: string) => {
    const { symbolGraph, workerPool, fileIndex, graphStatus } = get();
    if (graphStatus !== 'ready' || !symbolGraph || !workerPool || !fileIndex) return;

    const fileEntry = fileIndex.get(path);
    if (!fileEntry) return;

    try {
      const content = await fileEntry.getText();
      const result = await workerPool.execute('ANALYZE_FILE', { path, content });
      
      if (result.payload) {
        const metadata = result.payload;
        const newGraph = new Map(symbolGraph);
        for (const [id, node] of newGraph.entries()) {
          if (node.filePath === path) newGraph.delete(id);
        }
        newGraph.set(path, {
          id: path,
          filePath: path,
          symbolName: '(file)',
          dependencies: new Set(),
          dependents: new Set(),
          hasReexports: metadata.hasReexports,
          hasLogicActivity: metadata.hasLogicActivity
        });
        set({ symbolGraph: newGraph });
      }
    } catch (e) { /* ignore */ }
  },

  /**
   * Orchestrates the optimistic background assembly job.
   */
  orchestrateAssembly: async (targets, options) => {
    const { fileIndex, workerPool, symbolGraph } = get();
    if (!fileIndex || !workerPool || targets.length === 0) {
      set({ assembledPackText: null, accurateTokenCount: null, isAssembling: false });
      return;
    }

    // 1. Generate Request correlation ID for the closure
    const requestId = crypto.randomUUID();
    latestAssemblyRequestId = requestId;

    set({ isAssembling: true });

    try {
      // 2. Gather contents for targets and potential boundary leaks
      // To perform a Layer 1.5 scan, we need the text of files imported by our targets.
      const pathsToFetch = new Set(targets.map(t => t.path));
      
      if (options.includeBoundaryLibrary && symbolGraph) {
        targets.forEach(t => {
          const node = symbolGraph.get(t.path);
          if (node) {
            node.dependencies.forEach(depPath => {
              if (!pathsToFetch.has(depPath)) pathsToFetch.add(depPath);
            });
          }
        });
      }

      const fileContents: Record<string, string> = {};
      const fetchTasks = Array.from(pathsToFetch).map(async (path) => {
        const entry = fileIndex.get(path);
        if (entry) {
          fileContents[path] = await entry.getText();
        }
      });

      await Promise.all(fetchTasks);

      // 3. Check for Interruption (Trigger 2 Interrupt)
      if (latestAssemblyRequestId !== requestId) return;

      // 4. Dispatch to Worker
      const result = await workerPool.execute('ASSEMBLE_PACK', {
        assembly: {
          targets,
          files: fileContents,
          options
        }
      });

      // 5. Final check before updating state
      if (latestAssemblyRequestId === requestId && result.assembly) {
        set({
          assembledPackText: result.assembly.fullText,
          accurateTokenCount: result.assembly.tokenCount,
          isAssembling: false
        });
      }

    } catch (e) {
      console.error('[Assembly] Background orchestration failed:', e);
      if (latestAssemblyRequestId === requestId) {
        set({ isAssembling: false });
      }
    }
  }
});