/**
 * @file packages/core/src/state/slicer-graph-manager.ts
 * @stamp {"ts":"2026-02-16T19:05:00Z"}
 * @architectural-role State Management
 * @description
 * Manages the lifecycle of the architectural Symbol Graph and the semantic 
 * Type/Signature libraries. Orchestrates background assembly and ensures 
 * that analysis results from workers are correctly aggregated into the 
 * project-wide "Type Dictionary."
 *
 * @core-principles
 * 1. PERFORMANCE: MUST delegate heavy assembly and semantic mining to background workers.
 * 2. INTEGRITY: ENFORCES a "Last-Task-Wins" policy to prevent stale results.
 * 3. AGGREGATION: Acts as the librarian, consolidating worker-thread distilled metadata.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Updates global store state.
 *     state_ownership: [symbolGraph, typeLibrary, signatureLibrary, accurateTokenCount, isAssembling, assembledPackText]
 *     external_io: none
 */

import type { StateCreator } from 'zustand';
import type { SlicerState } from './slicer-state.js';
import { WorkerPool } from '../logic/worker/WorkerPool.js';
import { buildSymbolGraph, type SymbolGraph } from '../logic/symbolGraph/index.js';
import type { WorkerResult, DistilledMetadata } from '../logic/worker/types.js';

/**
 * Tracks the ID of the most recent assembly request to handle cancellation.
 */
let latestAssemblyRequestId: string | null = null;

/**
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
      // During initial build, the indexer will call processWorkerMetadata (via building the graph)
      // which populates our semantic dictionaries.
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
    const { symbolGraph, workerPool, fileIndex, graphStatus, typeLibrary, signatureLibrary } = get();
    if (graphStatus !== 'ready' || !symbolGraph || !workerPool || !fileIndex) return;

    const fileEntry = fileIndex.get(path);
    if (!fileEntry) return;

    try {
      const content = await fileEntry.getText();
      const result = await workerPool.execute('ANALYZE_FILE', { path, content });
      
      if (result.payload) {
        const metadata = result.payload;
        
        // 1. Update Semantic Libraries
        const nextTypeLib = new Map(typeLibrary);
        const nextSignLib = new Map(signatureLibrary);
        nextTypeLib.set(path, metadata.typeRegistry);
        nextSignLib.set(path, metadata.syntheticSignatures);

        // 2. Update Graph Nodes
        const nextGraph = new Map(symbolGraph);
        // Clear old symbol nodes for this file
        for (const [id, node] of nextGraph.entries()) {
          if (node.filePath === path) nextGraph.delete(id);
        }
        
        // Re-inject file-level node and symbols
        nextGraph.set(path, {
          id: path,
          filePath: path,
          symbolName: '(file)',
          dependencies: new Set(),
          dependents: new Set(),
          hasReexports: metadata.hasReexports,
          hasLogicActivity: metadata.hasLogicActivity
        });

        metadata.symbols.forEach(sym => {
          const id = `${path}#${sym}`;
          nextGraph.set(id, {
            id,
            filePath: path,
            symbolName: sym,
            dependencies: new Set(),
            dependents: new Set(),
            hasReexports: metadata.hasReexports,
            hasLogicActivity: metadata.hasLogicActivity
          });
        });

        set({ 
          symbolGraph: nextGraph,
          typeLibrary: nextTypeLib,
          signatureLibrary: nextSignLib
        });
      }
    } catch (e) { /* ignore */ }
  },

  orchestrateAssembly: async (targets, options) => {
    const { fileIndex, workerPool, symbolGraph } = get();
    if (!fileIndex || !workerPool || targets.length === 0) {
      set({ assembledPackText: null, accurateTokenCount: null, isAssembling: false });
      return;
    }

    const requestId = crypto.randomUUID();
    latestAssemblyRequestId = requestId;

    set({ isAssembling: true });

    try {
      // Gather contents for targets and potential boundary dependencies
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

      if (latestAssemblyRequestId !== requestId) return;

      const result = await workerPool.execute('ASSEMBLE_PACK', {
        assembly: {
          targets,
          files: fileContents,
          options
        }
      });

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

/**
 * Helper used by buildSymbolGraph orchestrator (logic/symbolGraph/index.ts)
 * to process distilled metadata into the store maps.
 * Note: This function is logically called via the set() in createLoaderSlice
 * when buildSymbolGraph completes, but the GraphSlice creator handles the mapping.
 */
export function aggregateMetadataToLibrary(
  results: WorkerResult[], 
  typeLib: Map<string, Record<string, string>>, 
  signLib: Map<string, Record<string, string>>
) {
  results.forEach(res => {
    if (res.payload) {
      typeLib.set(res.payload.filePath, res.payload.typeRegistry);
      signLib.set(res.payload.filePath, res.payload.syntheticSignatures);
    }
  });
}