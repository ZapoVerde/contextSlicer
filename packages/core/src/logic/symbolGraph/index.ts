/**
 * @file packages/core/src/logic/symbolGraph/index.ts
 * @stamp {"ts":"2025-09-29T00:13:50Z"}
 * @architectural-role Feature Orchestrator / Public API
 *
 * @description
 * This file serves as the main public entry point for the symbol graph generation
 * feature. It orchestrates the necessary setup, including the crucial
 * initialization of the dynamic `PathResolver`, and then invokes the AST parser
 * to perform the heavy lifting of building the graph.
 *
 * @responsibilities
 * 1.  IT IS THE SOLE ENTRY POINT: It exports the primary `buildSymbolGraph`
 *     function, which is the single function that the rest of the application
 *     (specifically the `useZipStore`) calls to initiate the entire graph
 *     generation process.
 *
 * 2.  IT MUST INITIALIZE THE RESOLVER: Its most critical responsibility is to
 *     create and correctly configure the `PathResolver` instance. It achieves
 *     this by accepting the authoritative `aliasMap` from the state manager and
 *     passing it directly into the resolver's constructor.
 *
 * 3.  IT MUST ORCHESTRATE THE PARSER: After setting up the resolver, it calls
 *     the main `runASTParser` function, passing it the file index and the newly
 *     created resolver, along with the graph object to be populated.
 */
import { PathResolver } from './pathResolver';
import { runASTParser } from './astParser';
import type { SymbolGraph } from './types';
import type { FileEntry } from './types';

// Re-export the primary types and the tracer function for convenient access.
export { traceSymbolGraph } from './tracer';
export type { SymbolGraph, SymbolNode, FileEntry } from './types';

/**
 * Builds the complete symbol dependency graph from a map of file entries.
 * This function orchestrates the path resolution and AST parsing.
 * @param fileIndex - A map of file paths to FileEntry objects from the zip store.
 * @param aliasMap - The authoritative map of monorepo aliases from the manifest.
 * @returns A promise that resolves to the SymbolGraph.
 */
// --- START OF DYNAMIC ALIAS INTEGRATION (Logic Entry Point) ---
export async function buildSymbolGraph(
  fileIndex: Map<string, FileEntry>,
  aliasMap: Record<string, string>,
  errors: string[]
): Promise<SymbolGraph> {
  const graph: SymbolGraph = new Map();
  // The PathResolver is now initialized with the dynamic, authoritative alias map.
  const pathResolver = new PathResolver(Array.from(fileIndex.keys()), aliasMap);

  // The runASTParser function mutates the graph object passed to it.
  await runASTParser(fileIndex, pathResolver, graph, errors);
// --- END OF DYNAMIC ALIAS INTEGRATION (Logic Entry Point) ---

  console.log(`[SymbolGraph] Built graph with ${graph.size} symbols.`);
  return graph;
}