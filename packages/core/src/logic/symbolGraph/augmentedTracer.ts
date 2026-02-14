/**
 * @file packages/core/src/logic/symbolGraph/augmentedTracer.ts
 * @stamp {"ts":"2026-02-14T08:05:00Z"}
 * @architectural-role Business Logic
 * @description
 * The core logical tracing engine. Performs a BFS traversal of the symbol graph,
 * using AST analyzers to distinguish between logical junctions and passive pipes.
 * Enforces logical hop limits while allowing "free" passage through barrels.
 * 
 * @core-principles
 * 1. IS the primary engine for "Scent-Sensitive" tracing.
 * 2. ORCHESTRATES the use of barrel and flow analyzers during traversal.
 * 3. ENFORCES resource safety via a physical circuit breaker.
 * 
 * @api-declaration
 *   export function traceLogicalPath(
 *     graph: SymbolGraph, 
 *     astCache: Map<string, any>,
 *     startId: string, 
 *     options: TraceOptions
 *   ): TracedNode[];
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { SymbolGraph, TraceOptions, TracedNode, SymbolNode } from './types';
import { isBarrelFile } from './analyzers/barrelDetector';
import { analyzeFlow } from './analyzers/flowAnalyzer';

const PHYSICAL_LIMIT = 50; // Hard limit to prevent infinite wormhole loops

interface QueueItem {
  node: SymbolNode;
  logicalHops: number;
  physicalDepth: number;
  currentScent: string;
}

/**
 * @id packages/core/src/logic/symbolGraph/augmentedTracer.ts#traceLogicalPath
 * @description
 * Traces the dependency graph using logical hop counting.
 */
export function traceLogicalPath(
  graph: SymbolGraph,
  astCache: Map<string, any>,
  startId: string,
  options: TraceOptions
): TracedNode[] {
  const startNodes = new Set<SymbolNode>();
  const initialScent = options.initialScent || '';

  // 1. Resolve starting points
  if (startId.includes('#')) {
    const node = graph.get(startId);
    if (node) startNodes.add(node);
  } else {
    // Start from all symbols in the file
    graph.forEach(node => {
      if (node.filePath === startId) startNodes.add(node);
    });
  }

  if (startNodes.size === 0) return [];

  // 2. BFS Setup
  const queue: QueueItem[] = Array.from(startNodes).map(node => ({
    node,
    logicalHops: 0,
    physicalDepth: 0,
    // FALLBACK: Use provided scent, or symbol name, or empty if it's a file node
    currentScent: initialScent || (node.symbolName === '(file)' ? '' : node.symbolName)
  }));

  // Track the minimum logical hops found for each node to ensure we take the "cheapest" path
  const minLogicalHops = new Map<string, number>();
  const results = new Map<string, TracedNode>();

  // Initialize starts
  startNodes.forEach(n => {
    minLogicalHops.set(n.id, 0);
    results.set(n.filePath, {
      path: n.filePath,
      status: 'meaningful',
      scent: initialScent,
      depth: 0
    });
  });

  let head = 0;
  while (head < queue.length) {
    const { node, logicalHops, physicalDepth, currentScent } = queue[head++];

    if (logicalHops >= options.maxHops || physicalDepth >= PHYSICAL_LIMIT) {
      continue;
    }

    // Get neighbors based on direction
    const neighbors = new Set<string>();
    if (options.direction === 'dependencies' || options.direction === 'both') {
      node.dependencies.forEach(id => neighbors.add(id));
    }
    if (options.direction === 'dependents' || options.direction === 'both') {
      node.dependents.forEach(id => neighbors.add(id));
    }

    for (const neighborId of neighbors) {
      const neighborNode = graph.get(neighborId);
      if (!neighborNode) continue;

      const neighborPath = neighborNode.filePath;
      const ast = astCache.get(neighborPath);

      let isMeaningful = true;
      let nextScent = currentScent;
      let cost = 1;

      // 3. Logical Bypass Analysis
      if (options.mode === 'logical' && ast) {
        if (isBarrelFile(ast)) {
          cost = 0;
          isMeaningful = false;
        } else if (currentScent) {
          const flow = analyzeFlow(ast, currentScent);
          cost = flow.isMeaningful ? 1 : 0;
          isMeaningful = flow.isMeaningful;
          nextScent = flow.nextIdentifier;
        }
      } else if (options.mode === 'physical') {
        cost = 1;
        isMeaningful = true;
      }

      const nextLogicalHops = logicalHops + cost;

      // Only proceed if this path is within limits AND is cheaper (or equal) than any previously found path
      const prevMin = minLogicalHops.get(neighborId);
      if (nextLogicalHops <= options.maxHops && (prevMin === undefined || nextLogicalHops < prevMin)) {
        minLogicalHops.set(neighborId, nextLogicalHops);
        
        // Update results: prioritizing 'meaningful' status if depths are equal
        const existing = results.get(neighborPath);
        if (!existing || nextLogicalHops < existing.depth || (nextLogicalHops === existing.depth && isMeaningful)) {
          results.set(neighborPath, {
            path: neighborPath,
            status: isMeaningful ? 'meaningful' : 'passive',
            scent: nextScent,
            depth: nextLogicalHops
          });
        }

        queue.push({
          node: neighborNode,
          logicalHops: nextLogicalHops,
          physicalDepth: physicalDepth + 1,
          currentScent: nextScent
        });
      }
    }
  }

  return Array.from(results.values());
}