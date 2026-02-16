/**
 * @file packages/core/src/logic/symbolGraph/index.ts
 * @stamp {"ts":"2026-02-16T20:50:00Z"}
 * @architectural-role Orchestrator
 * @description
 * Orchestrates the parallel construction of the symbol graph and the collection 
 * of distilled semantic metadata. Processes files in batches to optimize 
 * throughput and returns raw worker results to facilitate global registry 
 * synchronization.
 *
 * @core-principles
 * 1. RESOURCE MANAGEMENT: MUST process files in chunks to optimize throughput.
 * 2. DATA PIPELINE: ENFORCES the propagation of worker-distilled metadata to the main store.
 * 3. EFFICIENCY: Lifts structural flags into nodes for instant logical tracing.
 *
 * @api-declaration
 *   export async function buildSymbolGraph(...): Promise<{ graph: SymbolGraph; results: WorkerResult[] }>;
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { PathResolver } from './pathResolver.js';
import type { SymbolGraph, SymbolNode, FileEntry } from './types.js';
import type { WorkerPool } from '../worker/WorkerPool.js';
import type { WorkerResult } from '../worker/types.js';
import { LogBuffer } from './logUtils.js';

// --- CONSTANTS ---
const CHUNK_SIZE = 100;

// --- PUBLIC API EXPORTS ---
export { traceLogicalPath } from './augmentedTracer.js';
export { generateSummary } from './summaryGenerator.js';
export { traceSymbolGraph } from './tracer.js';
export { scanBoundaries } from './boundaryScanner/index.js';
export { generateBoundaryLibrary } from './typeDefinitionExtractor.js';
export { isBarrelFile } from './analyzers/barrelDetector.js';
export { analyzeFlow } from './analyzers/flowAnalyzer.js';
export * from './types.js';

/**
 * @id packages/core/src/logic/symbolGraph/index.ts#buildSymbolGraph
 * @description
 * Builds the dependency graph and aggregates all distilled worker metadata.
 */
export async function buildSymbolGraph(
  fileIndex: Map<string, FileEntry>,
  aliasMap: Record<string, string>,
  errors: string[],
  workerPool: WorkerPool
): Promise<{ graph: SymbolGraph; results: WorkerResult[] }> {
  const logger = new LogBuffer('SymbolGraph');
  const graph: SymbolGraph = new Map();
  const pathResolver = new PathResolver(Array.from(fileIndex.keys()), aliasMap);

  const relevantFiles = Array.from(fileIndex.values()).filter((f) =>
    /\.(ts|tsx|js|jsx)$/.test(f.path)
  );

  logger.push(`Indexing ${relevantFiles.length} files in batches of ${CHUNK_SIZE}...`);

  const allResults: WorkerResult[] = [];

  // 1. Process files in chunks
  for (let i = 0; i < relevantFiles.length; i += CHUNK_SIZE) {
    const chunk = relevantFiles.slice(i, i + CHUNK_SIZE);
    
    const chunkTasks = chunk.map(async (file) => {
      try {
        const content = await file.getText();
        return await workerPool.execute('ANALYZE_FILE', {
          path: file.path,
          content,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[Worker Error] ${file.path}: ${msg}`);
        return null;
      }
    });

    const results = await Promise.all(chunkTasks);
    
    results.forEach((res) => {
      if (res) {
        allResults.push(res);
        processWorkerMetadata(res, graph);
      }
    });

    // Yield to main thread
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // 2. LINKING PASS: Connect Nodes
  logger.push('Performing linking pass...');
  
  allResults.forEach((res) => {
    if (!res || !res.payload) return;
    const { filePath: importerPath, imports } = res.payload;
    
    const importerNode = graph.get(importerPath);
    if (!importerNode) return;

    imports.forEach((importSource) => {
      const resolvedPath = pathResolver.resolve(importerPath, importSource, errors);
      if (resolvedPath && graph.has(resolvedPath)) {
        const exporterNode = graph.get(resolvedPath)!;
        importerNode.dependencies.add(resolvedPath);
        exporterNode.dependents.add(importerPath);
      }
    });
  });

  logger.push(`Build complete. Nodes: ${graph.size}`);
  logger.flush();
  
  return { 
    graph, 
    results: allResults 
  };
}

/**
 * Internal helper to convert distilled metadata into Graph Nodes.
 */
function processWorkerMetadata(res: WorkerResult, graph: SymbolGraph) {
  if (!res.payload) return;
  const { filePath, symbols, hasReexports, hasLogicActivity } = res.payload;

  if (!graph.has(filePath)) {
    graph.set(filePath, {
      id: filePath,
      filePath,
      symbolName: '(file)',
      dependencies: new Set(),
      dependents: new Set(),
      hasReexports,
      hasLogicActivity
    });
  }

  symbols.forEach((symbolName) => {
    const id = `${filePath}#${symbolName}`;
    if (!graph.has(id)) {
      graph.set(id, {
        id,
        filePath,
        symbolName,
        dependencies: new Set(),
        dependents: new Set(),
        hasReexports,
        hasLogicActivity
      });
    }
  });
}