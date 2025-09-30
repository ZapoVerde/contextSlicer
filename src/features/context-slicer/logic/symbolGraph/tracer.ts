/**
 * @file src/features/sourceDump/logic/symbolGraph/tracer.ts
 * @architectural-role Logic Engine / Graph Traversal
 *
 * @description This module provides the core function for traversing the symbol
 * graph. It takes a starting point, a direction, and a maximum depth ("hops") and
 * explores the dependency network to find all related files.
 *
 * @responsibilities
 * 1.  **Graph Traversal:** It implements a breadth-first search (BFS) algorithm to
 *     explore the graph. BFS is used to ensure that the `maxHops` limit is
 *     respected correctly, exploring layer by layer.
 * 2.  **Flexible Starting Point:** It can start its trace from either a specific
 *     symbol ID (e.g., `path/to/file.ts#myFunction`) or a file path (in which case
 *     it starts from all symbols within that file).
 * 3.  **Configurable Direction:** It can be configured to trace in three directions:
 *     - `dependencies`: Finds what the start node depends on (upstream).
 *     - `dependents`: Finds what depends on the start node (downstream).
 *     - `both`: Traces in both directions simultaneously.
 * 4.  **De-duplicated Output:** It returns a clean, de-duplicated array of all file
 *     paths that were visited during the trace, ready to be used to populate the
 *     targeted pack generator.
 */
import type { SymbolGraph, SymbolNode } from './types';

/**
 * Traces the dependency graph starting from a given symbol or file.
 * @param graph - The SymbolGraph to traverse.
 * @param startId - The starting symbol ID ('file.ts#symbol') or file path ('file.ts').
 * @param mode - 'dependencies', 'dependents', or 'both'.
 * @param maxHops - The maximum number of steps to traverse from the start.
 * @returns A de-duplicated array of file paths found during the trace.
 */
export function traceSymbolGraph(
  graph: SymbolGraph,
  startId: string,
  mode: 'dependencies' | 'dependents' | 'both',
  maxHops: number
): string[] {
  const startNodes = new Set<SymbolNode>();

  // Check if the startId is a specific symbol or a whole file.
  if (startId.includes('#')) {
    if (graph.has(startId)) {
      startNodes.add(graph.get(startId)!);
    }
  } else {
    // A file path was provided; start from all symbols within that file.
    graph.forEach(node => {
      if (node.filePath === startId) {
        startNodes.add(node);
      }
    });
  }

  if (startNodes.size === 0) {
    return [];
  }

  // Use a queue for a breadth-first search (BFS) to respect maxHops.
  const queue: [SymbolNode, number][] = Array.from(startNodes).map(node => [node, 0]);
  const visited = new Set<string>(Array.from(startNodes).map(n => n.id));
  const resultFilePaths = new Set<string>(Array.from(startNodes).map(n => n.filePath));

  let head = 0;
  while (head < queue.length) {
    const [currentNode, hops] = queue[head++];

    if (hops >= maxHops) {
      continue; // Stop traversing from this branch if we've reached max hops.
    }

    const nextNodeIds = new Set<string>();

    // Gather the next nodes to visit based on the selected mode.
    if (mode === 'dependencies' || mode === 'both') {
      currentNode.dependencies.forEach(id => nextNodeIds.add(id));
    }
    if (mode === 'dependents' || mode === 'both') {
      currentNode.dependents.forEach(id => nextNodeIds.add(id));
    }

    for (const nextId of nextNodeIds) {
      if (!visited.has(nextId) && graph.has(nextId)) {
        visited.add(nextId);
        const nextNode = graph.get(nextId)!;
        resultFilePaths.add(nextNode.filePath);
        queue.push([nextNode, hops + 1]);
      }
    }
  }

  return Array.from(resultFilePaths);
}