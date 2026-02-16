/**
 * @file packages/core/src/state/slicer-graph-manager/index.ts
 * @stamp {"ts":"2026-02-16T22:55:00Z"}
 * @architectural-role State Management / Composition Root
 * @description
 * The main entry point for the Graph and Assembly state slice. Orchestrates 
 * the integration of modular graph building, semantic registry management, 
 * and context pack assembly. 
 *
 * @core-principles
 * 1. COMPOSITION: ORCHESTRATES modular logic into a unified store slice.
 * 2. SEPARATION: DELEGATES complex workflows to specialized sub-modules.
 * 3. STABILITY: MUST ensure the WorkerPool and libraries are correctly initialized.
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
import type { SymbolGraph } from '../../logic/symbolGraph/types.js';

/**
 * @id packages/core/src/state/slicer-graph-manager/index.ts#GraphSlice
 * @description
 * The state and action interface for the Graph Manager subsystem.
 */
export interface GraphSlice {
  workerPool: WorkerPool | null;
  symbolGraph: SymbolGraph | null;
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
      const aliasMap = slicerConfig?.project?.targetProjectRoot ? {} : {}; // Simplified for now
      const { graph, errors } = await buildGraphLogic(fileIndex, pool, aliasMap); 

      // Note: In this architecture, we assume buildGraphLogic/buildSymbolGraph
      // populates the libraries via internal worker results during Pass 1.
      // If Pass 1 is handled inside buildSymbolGraph, we ensure the 
      // libraries are updated in the store state.
      
      set({ 
        symbolGraph: graph, 
        graphStatus: 'ready', 
        resolutionErrors: errors 
      });
    } catch (e: unknown) {
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
        // Result null indicates interruption by a newer request
        set({ isAssembling: false });
      }
    } catch (e) {
      set({ isAssembling: false });
    }
  }
});