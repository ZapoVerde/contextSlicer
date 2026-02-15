/**
 * @file packages/core/src/logic/symbolGraph/index.ts
 * @stamp {"ts":"2026-02-14T15:15:00Z"}
 * @architectural-role Feature Entry Point
 * @description
 * The public API barrel file for the symbol graph subsystem. Exposes the core
 * graph building logic, the advanced logical tracing engine, and the semantic
 * summary generator.
 * 
 * @core-principles
 * 1. IS the definitive public interface for the symbol graph package.
 * 2. MUST explicitly export components and types intended for cross-package consumption.
 * 3. ENFORCES encapsulation of internal traversal complexities.
 * 
 * @api-declaration
 *   export { buildSymbolGraph } from './index';
 *   export { traceLogicalPath } from './augmentedTracer';
 *   export { generateSummary } from './summaryGenerator';
 *   export { isBarrelFile } from './analyzers/barrelDetector';
 *   export { analyzeFlow } from './flowAnalyzer';
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

// Re-export core tracing and distillation logic
export * from './types';
export { traceLogicalPath } from './augmentedTracer';
export { generateSummary } from './summaryGenerator';
export { isBarrelFile } from './analyzers/barrelDetector';
export { analyzeFlow } from './analyzers/flowAnalyzer';
export { traceSymbolGraph } from './tracer'; // Legacy tracer

/**
 * @id packages/core/src/logic/symbolGraph/index.ts#buildSymbolGraph
 * @description
 * Builds the complete symbol dependency graph from a map of file entries.
 * This function orchestrates the path resolution and AST parsing.
 * 
 * @param fileIndex - A map of file paths to FileEntry objects.
 * @param aliasMap - The authoritative map of monorepo aliases.
 * @param errors - A collection to push error messages into.
 * @returns A promise that resolves to the SymbolGraph.
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