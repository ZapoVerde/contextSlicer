/**
 * @file packages/core/src/state/slicer-graph-manager/graphBuilder.ts
 * @stamp {"ts":"2026-02-16T21:05:00Z"}
 * @architectural-role Business Logic / Builder
 * @description
 * Manages the construction and incremental maintenance of the symbol dependency 
 * graph. Coordinates background analysis tasks via the WorkerPool and 
 * implements the logic for patching the graph and semantic libraries.
 *
 * @core-principles
 * 1. SEPARATION: MUST isolate graph construction from state storage.
 * 2. INCREMENTALISM: ENFORCES differential updates to prevent full re-indexes.
 * 3. PIPELINE-INTEGRITY: Propagates worker-distilled metadata to the main thread.
 *
 * @api-declaration
 *   export async function buildGraphLogic(...): Promise<{ graph: SymbolGraph; results: WorkerResult[]; errors: string[] }>;
 *   export async function patchNodeLogic(...): Promise<{ metadata: DistilledMetadata } | null>;
 *
 * @contract
 *   assertions:
 *     purity: side-effects # Performs worker execution.
 *     external_io: worker_pool
 */

import { buildSymbolGraph } from '../../logic/symbolGraph/index.js';
import type { SymbolGraph, FileEntry } from '../../logic/symbolGraph/types.js';
import type { WorkerPool } from '../../logic/worker/WorkerPool.js';
import type { DistilledMetadata, WorkerResult } from '../../logic/worker/types.js';

/**
 * @id packages/core/src/state/slicer-graph-manager/graphBuilder.ts#buildGraphLogic
 * @description
 * Orchestrates the full construction of the dependency graph and returns 
 * the raw worker results for registry synchronization.
 */
export async function buildGraphLogic(
  fileIndex: Map<string, FileEntry>,
  workerPool: WorkerPool,
  aliasMap: Record<string, string> = {}
): Promise<{ graph: SymbolGraph; results: WorkerResult[]; errors: string[] }> {
  const errors: string[] = [];
  const { graph, results } = await buildSymbolGraph(fileIndex, aliasMap, errors, workerPool);
  return { graph, results, errors };
}

/**
 * @id packages/core/src/state/slicer-graph-manager/graphBuilder.ts#patchNodeLogic
 * @description
 * Analyzes a single file and returns the distilled metadata for patching 
 * the graph and semantic registries.
 */
export async function patchNodeLogic(
  path: string,
  fileIndex: Map<string, FileEntry>,
  workerPool: WorkerPool
): Promise<{ metadata: DistilledMetadata } | null> {
  const fileEntry = fileIndex.get(path);
  if (!fileEntry) return null;

  try {
    const content = await fileEntry.getText();
    const result = await workerPool.execute('ANALYZE_FILE', { path, content });
    
    if (result.payload) {
      return { metadata: result.payload };
    }
  } catch (e) {
    console.error(`[GraphBuilder] Failed to patch node: ${path}`, e);
  }
  
  return null;
}

/**
 * @id packages/core/src/state/slicer-graph-manager/graphBuilder.ts#applyMetadataToGraph
 * @description
 * Pure utility to update a SymbolGraph Map with results from a single-file analysis.
 */
export function applyMetadataToGraph(
  path: string,
  metadata: DistilledMetadata,
  graph: SymbolGraph
): void {
  // 1. Remove existing entries for this file to prevent symbol duplication
  for (const [id, node] of graph.entries()) {
    if (node.filePath === path) {
      graph.delete(id);
    }
  }

  // 2. Insert File-level node
  graph.set(path, {
    id: path,
    filePath: path,
    symbolName: '(file)',
    dependencies: new Set(),
    dependents: new Set(),
    hasReexports: metadata.hasReexports,
    hasLogicActivity: metadata.hasLogicActivity
  });

  // 3. Insert Symbol-level nodes
  metadata.symbols.forEach(sym => {
    const id = `${path}#${sym}`;
    graph.set(id, {
      id,
      filePath: path,
      symbolName: sym,
      dependencies: new Set(),
      dependents: new Set(),
      hasReexports: metadata.hasReexports,
      hasLogicActivity: metadata.hasLogicActivity
    });
  });
}