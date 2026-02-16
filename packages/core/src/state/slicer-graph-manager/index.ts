/**
 * @file packages/core/src/state/slicer-graph-manager/index.ts
 * @stamp {"ts":"2026-02-16T21:15:00Z"}
 * @architectural-role State Management / Composition Root
 * @description
 * The main entry point for the Graph and Assembly state slice. Orchestrates 
 * the integration of modular graph building, semantic registry management, 
 * and context pack assembly. Now captures bulk indexing results to populate 
 * semantic libraries for architectural extraction.
 *
 * @core-principles
 * 1. COMPOSITION: ORCHESTRATES modular logic into a unified store slice.
 * 2. DATA PIPELINE: ENFORCES metadata synchronization between workers and state.
 * 3. SEPARATION: DELEGATES complex workflows to specialized sub-modules.
 *
 * @api-declaration
 *   export interface GraphSlice { ... }
 *   export const createGraphSlice: StateCreator<SlicerState, [], [], GraphSlice>;
 *
 * @contract
 *   assertions:
 *     purity: mutates # Standard Zustand state creator.
 *     external_io: none
 */

import type { StateCreator } from 'zustand';
import type { SlicerState } from '../slicer-state.js';
import { WorkerPool } from '../../logic/worker/WorkerPool.js';
import { buildGraphLogic, patchNodeLogic, applyMetadataToGraph } from './graphBuilder.js';
import { orchestrateAssembly as producePack } from './assemblyOrchestrator.js';
import { updateLibraries, bulkUpdateLibraries, type RegistryLibs } from './registry.js';

/**
 * @id packages/core/src/state/slicer-graph-manager/index.ts#GraphSlice
 * @description
 * The state and action interface for the Graph Manager subsystem.
 */
export interface GraphSlice {
  workerPool: WorkerPool | null;
  symbolGraph: import('../../logic/symbolGraph/types.js').SymbolGraph | null;
  graphStatus: 'idle' | 'building' | 'ready' | 'error';
  resolutionErrors: string[];
  
  // Optimistic Assembly Results
  isAssembling: boolean;
  assembledPackText: string | null;
  accurateTokenCount: number | null;

  // Semantic Libraries (Pre-computed Type Closure)
  typeLibrary: Map<string, Record<string, string>>;
  signatureLibrary: Map<string, Record<string, string>>;
  contractLibrary: Map<string, string>;

  // Actions
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
  
  isAssembling: false,
  assembledPackText: null,
  accurateTokenCount: null,

  typeLibrary: new Map(),
  signatureLibrary: new Map(),
  contractLibrary: new Map(),

  /**
   * Triggers the initial build of the dependency graph and semantic libraries.
   */
  ensureSymbolGraph: async () => {
    const { graphStatus, fileIndex, symbolGraph, slicerConfig } = get();
    
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
      // 1. Build Graph Topology and collect raw worker metadata
      const { graph, results, errors } = await buildGraphLogic(fileIndex, pool, {}); 

      // 2. Prepare Local Library Buffers
      const libs: RegistryLibs = {
        typeLibrary: new Map(),
        signatureLibrary: new Map(),
        contractLibrary: new Map()
      };

      // 3. Populate Libraries from Worker Results
      bulkUpdateLibraries(results, libs);
      
      // 4. Update Store
      set({ 
        symbolGraph: graph, 
        ...libs,
        graphStatus: 'ready', 
        resolutionErrors: errors 
      });
    } catch (e: unknown) {
      console.error('[GraphManager] Initialization failed:', e);
      set({ 
        graphStatus: 'error',
        resolutionErrors: ['FATAL: Graph generation failed.'],
      });
    }
  },

  /**
   * Performs an incremental update for a single changed file.
   */
  patchGraphNode: async (path: string) => {
    const { 
      symbolGraph, workerPool, fileIndex, graphStatus, 
      typeLibrary, signatureLibrary, contractLibrary 
    } = get();
    
    if (graphStatus !== 'ready' || !symbolGraph || !workerPool || !fileIndex) return;

    const result = await patchNodeLogic(path, fileIndex, workerPool);
    
    if (result) {
      const nextGraph = new Map(symbolGraph);
      const libs: RegistryLibs = {
        typeLibrary: new Map(typeLibrary),
        signatureLibrary: new Map(signatureLibrary),
        contractLibrary: new Map(contractLibrary)
      };

      // 1. Update Graph Topology
      applyMetadataToGraph(path, result.metadata, nextGraph);

      // 2. Update Semantic Registries
      updateLibraries(path, result.metadata, libs);

      set({ 
        symbolGraph: nextGraph,
        ...libs
      });
    }
  },

  /**
   * Orchestrates the background generation of a context pack.
   */
  orchestrateAssembly: async (targets, options) => {
    const { fileIndex, workerPool, symbolGraph, contractLibrary } = get();
    
    if (!fileIndex || !workerPool || targets.length === 0) {
      set({ assembledPackText: null, accurateTokenCount: null, isAssembling: false });
      return;
    }

    set({ isAssembling: true });

    try {
      const result = await producePack(targets, options, {
        workerPool,
        fileIndex,
        symbolGraph,
        contractLibrary
      });

      if (result) {
        set({
          assembledPackText: result.fullText,
          accurateTokenCount: result.tokenCount,
          isAssembling: false
        });
      } else {
        set({ isAssembling: false });
      }
    } catch (e) {
      set({ isAssembling: false });
    }
  }
});