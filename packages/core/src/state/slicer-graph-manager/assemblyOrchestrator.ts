/**
 * @file packages/core/src/state/slicer-graph-manager/assemblyOrchestrator.ts
 * @stamp {"ts":"2026-02-16T22:45:00Z"}
 * @architectural-role Business Logic / Producer
 * @description
 * Orchestrates the multi-stage pipeline for context pack generation. Manages 
 * background assembly requests, shallow boundary dependency resolution, and 
 * data serialization for worker thread communication. Updated to serialize 
 * and pipe semantic registries to the worker.
 *
 * @core-principles
 * 1. ORCHESTRATION: MUST manage the transition from UI selection to binary assembly.
 * 2. INTEGRITY: ENFORCES the "Last-Task-Wins" correlation pattern to prevent stale packs.
 * 3. EFFICIENCY: Minimizes I/O by fetching only the content required for the pack.
 *
 * @api-declaration
 *   export async function orchestrateAssembly(...): Promise<AssemblyResult | null>;
 *
 * @contract
 *   assertions:
 *     purity: side-effects # Performs I/O and worker execution.
 *     external_io: worker_pool
 */

import type { FileEntry } from '../slicer-state.js';
import type { SymbolGraph } from '../../logic/symbolGraph/types.js';
import type { WorkerPool } from '../../logic/worker/WorkerPool.js';
import type { AssemblyPayload, AssemblyResult } from '../../logic/worker/types.js';

/**
 * Tracks the ID of the most recent assembly request globally within this module.
 */
let latestAssemblyRequestId: string | null = null;

interface AssemblyDeps {
  workerPool: WorkerPool;
  fileIndex: Map<string, FileEntry>;
  symbolGraph: SymbolGraph | null;
  contractLibrary: Map<string, string>;
  typeLibrary: Map<string, Record<string, string>>;
  signatureLibrary: Map<string, Record<string, string>>;
}

/**
 * @id packages/core/src/state/slicer-graph-manager/assemblyOrchestrator.ts#orchestrateAssembly
 * @description
 * Coordinates the background assembly of a context pack. Resolves dependencies 
 * for the boundary library and serializes semantic data for the worker thread.
 */
export async function orchestrateAssembly(
  targets: Array<{ path: string; resolution: 'full' | 'summary' }>,
  options: { docblocksOnly: boolean; includeBoundaryLibrary: boolean },
  deps: AssemblyDeps
): Promise<AssemblyResult | null> {
  const { 
    workerPool, 
    fileIndex, 
    symbolGraph, 
    contractLibrary, 
    typeLibrary, 
    signatureLibrary 
  } = deps;

  // 1. Generate Correlation ID
  const requestId = crypto.randomUUID();
  latestAssemblyRequestId = requestId;

  try {
    // 2. Identify and Fetch Required Content
    // We need text for every target file + potential boundary symbols.
    const pathsToFetch = new Set(targets.map((t) => t.path));

    if (options.includeBoundaryLibrary && symbolGraph) {
      targets.forEach((target) => {
        const node = symbolGraph.get(target.path);
        if (node) {
          node.dependencies.forEach((depPath) => {
            if (!pathsToFetch.has(depPath)) {
              pathsToFetch.add(depPath);
            }
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

    // 3. Interruption Check (Did a new request start while we were fetching?)
    if (latestAssemblyRequestId !== requestId) {
      return null;
    }

    // 4. Data Serialization
    // Convert Map-based libraries into plain objects for thread transfer.
    const contractLibPayload: Record<string, string> = {};
    contractLibrary.forEach((brief, path) => {
      contractLibPayload[path] = brief;
    });

    const typeLibPayload: Record<string, Record<string, string>> = {};
    typeLibrary.forEach((records, path) => {
      typeLibPayload[path] = records;
    });

    const signatureLibPayload: Record<string, Record<string, string>> = {};
    signatureLibrary.forEach((records, path) => {
      signatureLibPayload[path] = records;
    });

    const payload: AssemblyPayload = {
      targets,
      files: fileContents,
      contractLibrary: contractLibPayload,
      typeLibrary: typeLibPayload,
      signatureLibrary: signatureLibPayload,
      options,
    };

    // 5. Worker Execution
    const result = await workerPool.execute('ASSEMBLE_PACK', {
      assembly: payload,
    });

    // 6. Final Interruption Check
    if (latestAssemblyRequestId === requestId && result.assembly) {
      return result.assembly;
    }

    return null;
  } catch (e) {
    console.error('[AssemblyOrchestrator] Failed to produce context pack:', e);
    throw e;
  }
}