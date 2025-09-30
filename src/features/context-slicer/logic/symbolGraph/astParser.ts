/**
 * @file src/features/sourceDump/logic/symbolGraph/astParser.ts
 * @architectural-role Orchestrator
 *
 * @description This module orchestrates the entire multi-pass process of building the
 * symbol dependency graph. It imports the logic for each pass from dedicated modules
 * and executes them in the correct sequence.
 *
 * @responsibilities
 * 1.  **Process Orchestration:** Defines the high-level sequence of the build process:
 *     - Pass 1: Build the AST cache.
 *     - Pass 2: Discover all symbol and file nodes.
 *     - Pass 3: Link the nodes by resolving dependencies.
 * 2.  **Data Flow Management:** It manages the flow of data between the passes,
 *     taking the output from one pass (like the `astCache`) and providing it as
 *     input to the subsequent passes.
 * 3.  **Encapsulation:** It encapsulates the complexity of the multi-pass architecture,
 *     providing a single, simple function (`runASTParser`) to the rest of the
 *     application.
 */
import type { FileEntry, SymbolGraph } from './types';
import { PathResolver } from './pathResolver';

// Import the logic for each individual pass.
import { buildAstCache } from './passes/1_buildAstCache';
import { discoverSymbols } from './passes/2_discoverSymbols';
import { linkDependencies } from './passes/3_linkDependencies';

/**
 * The main orchestrator function that runs the multi-pass graph building process.
 * @param fileIndex - The global map of all file entries from the zip.
 * @param pathResolver - The utility for resolving module paths.
 * @param graph - The graph instance to be populated. This function mutates the graph. 
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
  discoverSymbols(astCache, graph);

  // Pass 3: Traverse the ASTs again to find imports and link the nodes together.
  linkDependencies(astCache, graph, pathResolver, errors);
}