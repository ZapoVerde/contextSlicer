/**
 * @file packages/core/src/logic/symbolGraph/augmentedTracer.ts
 * @stamp {"ts":"2026-02-15T23:40:00Z"}
 * @architectural-role Business Logic
 * @description
 * The core logical tracing engine. Performs a BFS traversal of the symbol graph
 * using the Two-Part Pipe Detection Rule. Structural passthroughs (Pipes) cost 
 * 0 hops, while logic-bearing files cost 1 hop. Enforces a distance-based 
 * resolution gradient and provides detailed diagnostic logging.
 * 
 * @core-principles
 * 1. ENFORCES the Two-Part Pipe Rule: cost 0 only if (Re-exports AND No Activity).
 * 2. PRIORITIZES distance-based resolution: nearby logic files must be Full Code.
 * 3. PROVIDES observability through structured console telemetry.
 * 
 * @api-declaration
 *   export function traceLogicalPath(
 *     graph: SymbolGraph, 
 *     astCache: Map<string, Node>,
 *     startId: string, 
 *     options: TraceOptions
 *   ): TracedNode[];
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { Node } from '@babel/types';
import type { SymbolGraph, TraceOptions, TracedNode, SymbolNode, ResolutionLevel } from './types';
import { hasReexports } from './analyzers/barrelDetector';
import { hasLogicActivity } from './analyzers/flowAnalyzer';

const PHYSICAL_LIMIT = 150; // Safety boundary for deep physical chains

interface QueueItem {
  node: SymbolNode;
  logicalHops: number;
  physicalDepth: number;
}

/**
 * @id packages/core/src/logic/symbolGraph/augmentedTracer.ts#traceLogicalPath
 * @description
 * Traces the dependency graph using the structural Pipe Detection Rule with diagnostic logging.
 */
export function traceLogicalPath(
  graph: SymbolGraph,
  astCache: Map<string, Node>,
  startId: string,
  options: TraceOptions
): TracedNode[] {
  console.groupCollapsed(`[Tracer] Starting trace from ${startId}`);
  console.log('Options:', options);

  const startNodes = new Set<SymbolNode>();
  const totalMaxHops = Math.max(options.maxHops, options.summaryHops);

  // 1. Resolve starting points (Seed)
  if (startId.includes('#')) {
    const node = graph.get(startId);
    if (node) {
      startNodes.add(node);
    }
  } else {
    graph.forEach(node => {
      if (node.filePath === startId) {
        startNodes.add(node);
      }
    });
  }

  if (startNodes.size === 0) {
    console.warn('[Tracer] No start nodes found.');
    console.groupEnd();
    return [];
  }

  // 2. BFS Setup
  const queue: QueueItem[] = Array.from(startNodes).map(node => ({
    node,
    logicalHops: 0,
    physicalDepth: 0,
  }));

  const minLogicalHops = new Map<string, number>();
  const results = new Map<string, TracedNode>();

  // Initialize seed nodes (Seeds are always meaningful and full)
  startNodes.forEach(n => {
    minLogicalHops.set(n.id, 0);
    results.set(n.filePath, {
      path: n.filePath,
      status: 'meaningful',
      resolution: 'full',
      scent: '',
      depth: 0
    });
    console.log(`[Seed] ${n.filePath}`);
  });

  let head = 0;
  while (head < queue.length) {
    const { node, logicalHops, physicalDepth } = queue[head++];

    if (logicalHops > totalMaxHops || physicalDepth >= PHYSICAL_LIMIT) {
      continue;
    }

    // Determine neighbors based on direction
    const neighbors = new Set<string>();
    if (options.direction === 'dependencies' || options.direction === 'both') {
      node.dependencies.forEach(id => neighbors.add(id));
    }
    if (options.direction === 'dependents' || options.direction === 'both') {
      node.dependents.forEach(id => neighbors.add(id));
    }

    for (const neighborId of neighbors) {
      const neighborNode = graph.get(neighborId);
      if (!neighborNode) {
        continue;
      }

      const neighborPath = neighborNode.filePath;
      const ast = astCache.get(neighborPath);

      // 3. Apply the Two-Part Pipe Detection Rule
      // A file is a Pipe ONLY if it (Has Re-exports) AND (Has NO Logic Activity)
      const reexports = ast ? hasReexports(ast) : false;
      const activity = ast ? hasLogicActivity(ast) : true; 
      
      const isPipe = reexports && !activity;
      const isLogic = !isPipe;
      const debugReason = isPipe ? 'Pure Pipe (Re-export only)' : 'Logic/Activity Detected';
      
      // Cost 0 for Pipes (Wormholes), Cost 1 for Logic (Functional Files)
      const cost = isPipe ? 0 : 1;
      const nextLogicalHops = logicalHops + cost;

      // 4. Boundary Enforcement
      if (nextLogicalHops > totalMaxHops) {
        continue;
      }

      // 5. Resolution Assignment (Distance-First Gradient)
      // Passive pipes are ALWAYS summarized unless they were seed files.
      let resolution: ResolutionLevel = 'summary';

      if (isLogic && nextLogicalHops <= options.maxHops) {
        resolution = 'full';
      }

      // 6. Cheap-Path BFS Update
      const prevMin = minLogicalHops.get(neighborId);
      const existing = results.get(neighborPath);
      
      const isNewNode = prevMin === undefined;
      const isShorterPath = !isNewNode && nextLogicalHops < prevMin;
      const isResolutionUpgrade = !isNewNode && !isShorterPath && existing?.resolution === 'summary' && resolution === 'full';

      if (isNewNode || isShorterPath || isResolutionUpgrade) {
        minLogicalHops.set(neighborId, nextLogicalHops);
        
        results.set(neighborPath, {
          path: neighborPath,
          status: isLogic ? 'meaningful' : 'passive',
          resolution,
          scent: '',
          depth: nextLogicalHops
        });

        console.log(
          `[Add] ${neighborPath} | Depth: ${nextLogicalHops} | Type: ${resolution} | Reason: ${debugReason}`
        );

        queue.push({
          node: neighborNode,
          logicalHops: nextLogicalHops,
          physicalDepth: physicalDepth + 1,
        });
      }
    }
  }

  console.log(`[Tracer] Trace complete. Found ${results.size} unique files.`);
  console.groupEnd();

  return Array.from(results.values());
}