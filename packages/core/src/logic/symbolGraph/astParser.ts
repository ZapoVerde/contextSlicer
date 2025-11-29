/**
 * @file packages/core/src/logic/symbolGraph/astParser.ts
 * @stamp {"ts":"2025-11-29T03:40:00Z"}
 * @architectural-role Orchestrator
 *
 * @description
 * Orchestrates the multi-pass symbol graph generation process.
 * Acts as the bridge between the raw file index and the specific logic passes.
 *
 * @core-principles
 * 1. OWNS the execution sequence of the graph building passes.
 * 2. MANAGES the flow of data (AST Cache, Graph) between passes.
 * 3. DELEGATES specific analysis logic to sub-modules.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Modifies the graph object passed by reference.
 *     state_ownership: none
 *     external_io: none
 */

import type { FileEntry, SymbolGraph } from './types';
import { PathResolver } from './pathResolver';

// Import the logic for each individual pass.
import { buildAstCache } from './passes/1_buildAstCache';
import { discoverSymbols } from './passes/2_discoverSymbols';
import { linkDependencies } from './passes/3_linkDependencies';

/**
 * The main orchestrator function that runs the multi-pass graph building process.
 * @param fileIndex - The global map of all file entries.
 * @param pathResolver - The utility for resolving module paths.
 * @param graph - The graph instance to be populated (mutation target).
 * @param errors - A collection to push error messages into.
 */
export async function runASTParser(
  fileIndex: Map<string, FileEntry>,
  pathResolver: PathResolver,
  graph: SymbolGraph,
  errors: string[]
): Promise<void> {
  // Pass 1: Parse all files into an AST and cache the results.
  const astCache = await buildAstCache(fileIndex);

  // Pass 2: Traverse the ASTs to find all symbols and create nodes in the graph.
  // Now accepts 'errors' to report files that couldn't be traversed.
  // FIX: Must pass 'errors' as the 3rd argument.
  discoverSymbols(astCache, graph, errors);

  // Pass 3: Traverse the ASTs again to find imports and link the nodes together.
  linkDependencies(astCache, graph, pathResolver, errors);
}