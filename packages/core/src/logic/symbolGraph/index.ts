/**
 * @file packages/core/src/logic/symbolGraph/index.ts
 * @stamp {"ts":"2026-02-15T10:25:00Z"}
 * @architectural-role Feature Entry Point
 * @description
 * The authoritative public API barrel for the symbol graph subsystem. It exposes 
 * graph building, logical tracing, and the "Boundary Library" extraction engine.
 * 
 * @core-principles
 * 1. IS the definitive public interface for the symbol graph package.
 * 2. MUST explicitly export components required for context pack assembly.
 * 3. ENFORCES encapsulation of internal traversal complexities.
 * 
 * @api-declaration
 *   export { buildSymbolGraph } from './index';
 *   export { traceLogicalPath } from './augmentedTracer';
 *   export { generateSummary } from './summaryGenerator';
 *   export { scanBoundaries } from './boundaryScanner';
 *   export { generateBoundaryLibrary } from './typeDefinitionExtractor';
 *   export * from './types';
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { PathResolver } from './pathResolver';
import { runASTParser } from './astParser';
import type { SymbolGraph, FileEntry } from './types';

// Export Core Engine Logic
export { traceLogicalPath } from './augmentedTracer';
export { generateSummary } from './summaryGenerator';
export { traceSymbolGraph } from './tracer'; 
export { isBarrelFile } from './analyzers/barrelDetector';
export { analyzeFlow } from './analyzers/flowAnalyzer';

// Export Boundary Discovery & Extraction (Required by Pack Assembler)
export { scanBoundaries } from './boundaryScanner';
export { generateBoundaryLibrary } from './typeDefinitionExtractor';

// Export Shared Schemas
export * from './types';

/**
 * @id packages/core/src/logic/symbolGraph/index.ts#buildSymbolGraph
 * @description
 * Builds the complete symbol dependency graph from a map of file entries.
 */
export async function buildSymbolGraph(
  fileIndex: Map<string, FileEntry>,
  aliasMap: Record<string, string>,
  errors: string[]
): Promise<SymbolGraph> {
  const graph: SymbolGraph = new Map();
  const pathResolver = new PathResolver(Array.from(fileIndex.keys()), aliasMap);

  // The runASTParser function mutates the graph object passed to it.
  await runASTParser(fileIndex, pathResolver, graph, errors);

  return graph;
}