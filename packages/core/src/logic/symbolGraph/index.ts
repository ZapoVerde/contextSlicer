/**
 * @file packages/core/src/logic/symbolGraph/index.ts
 * @stamp {"ts":"2026-02-16T18:45:00Z"}
 * @architectural-role Orchestrator
 * @description
 * The authoritative public API for the symbol graph subsystem. Orchestrates 
 * the parallelized construction of the code graph using the Worker Pool. 
 * Aggregates distilled metadata from background threads to build a 
 * physical dependency network with cross-file linking.
 *
 * @core-principles
 * 1. ASYNC ORCHESTRATION: MUST leverage the Worker Pool for all heavy parsing.
 * 2. AGGREGATION: IS responsible for reassembling worker results into the main Graph.
 * 3. DISTRIBUTED LINKING: ENFORCES the "Zero-AST Return" policy by linking via 
 *    distilled import strings in the main thread.
 *
 * @api-declaration
 *   export function buildSymbolGraph(index, aliasMap, errors, workerPool): Promise<SymbolGraph>;
 *   export { traceLogicalPath } from './augmentedTracer';
 *   export { generateSummary } from './summaryGenerator';
 *   export * from './types';
 *
 * @contract
 *   assertions:
 *     purity: pure # Orchestrates state but returns a new Graph instance.
 *     external_io: none
 */

import { PathResolver } from './pathResolver.js';
import type { SymbolGraph, SymbolNode, FileEntry } from './types.js';
import type { WorkerPool } from '../worker/WorkerPool.js';

// --- PUBLIC API EXPORTS ---

// 1. Tracing and Distillation Logic
export { traceLogicalPath } from './augmentedTracer.js';
export { generateSummary } from './summaryGenerator.js';
export { traceSymbolGraph } from './tracer.js';

// 2. Boundary Discovery & Extraction (Required by Pack Assembler)
export { scanBoundaries } from './boundaryScanner/index.js';
export { generateBoundaryLibrary } from './typeDefinitionExtractor.js';

// 3. Structural Analyzers
export { isBarrelFile } from './analyzers/barrelDetector.js';
export { analyzeFlow } from './analyzers/flowAnalyzer.js';

// 4. Shared Types
export * from './types.js';

/**
 * @id packages/core/src/logic/symbolGraph/index.ts#buildSymbolGraph
 * @description
 * Builds the complete symbol dependency graph asynchronously using the Worker Pool.
 * 
 * @param fileIndex - The registry of available files.
 * @param aliasMap - Path aliases for module resolution.
 * @param errors - Collection for reporting non-fatal analysis errors.
 * @param workerPool - The persistent worker pool for parallel processing.
 */
export async function buildSymbolGraph(
  fileIndex: Map<string, FileEntry>,
  aliasMap: Record<string, string>,
  errors: string[],
  workerPool: WorkerPool
): Promise<SymbolGraph> {
  const graph: SymbolGraph = new Map();
  const pathResolver = new PathResolver(Array.from(fileIndex.keys()), aliasMap);

  // 1. Identify files requiring analysis (JS/TS source files)
  const relevantFiles = Array.from(fileIndex.values()).filter((f) =>
    /\.(ts|tsx|js|jsx)$/.test(f.path)
  );

  console.log(`[SymbolGraph] Dispatching ${relevantFiles.length} files to Worker Pool...`);

  // 2. Dispatch analysis tasks in parallel (Pass 1 & 2 in Workers)
  const analysisPromises = relevantFiles.map(async (file) => {
    try {
      const content = await file.getText();
      const result = await workerPool.execute('ANALYZE_FILE', {
        path: file.path,
        content,
      });
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[Worker Error] ${file.path}: ${msg}`);
      return null;
    }
  });

  const results = await Promise.all(analysisPromises);

  // 3. AGGREGATION PASS: Create Nodes (The Dots)
  results.forEach((res) => {
    if (!res || !res.payload) return;
    const metadata = res.payload;
    const filePath = metadata.filePath;

    // Create File-level node
    if (!graph.has(filePath)) {
      graph.set(filePath, {
        id: filePath,
        filePath,
        symbolName: '(file)',
        dependencies: new Set(),
        dependents: new Set(),
      });
    }

    // Create Symbol-level nodes
    metadata.symbols.forEach((symbolName) => {
      const id = `${filePath}#${symbolName}`;
      if (!graph.has(id)) {
        graph.set(id, {
          id,
          filePath,
          symbolName,
          dependencies: new Set(),
          dependents: new Set(),
        });
      }
    });
  });

  // 4. LINKING PASS: Connect Nodes (The Lines)
  // We process the distilled import strings returned by the workers.
  console.log('[SymbolGraph] Performing main-thread linking pass...');
  
  results.forEach((res) => {
    if (!res || !res.payload) return;
    const { filePath: importerPath, imports } = res.payload;
    
    const importerNode = graph.get(importerPath);
    if (!importerNode) return;

    imports.forEach((importSource) => {
      // Resolve the import string to an absolute project path
      const resolvedPath = pathResolver.resolve(importerPath, importSource, errors);
      
      // Check if the resolved file exists in our graph
      if (resolvedPath && graph.has(resolvedPath)) {
        const exporterNode = graph.get(resolvedPath)!;
        
        // Establish bidirectional physical edge
        importerNode.dependencies.add(resolvedPath);
        exporterNode.dependents.add(importerPath);
      }
    });
  });

  console.log(`[SymbolGraph] Build complete. Total nodes: ${graph.size}`);
  
  return graph;
}