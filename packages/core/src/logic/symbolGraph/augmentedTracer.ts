/**
 * @file packages/core/src/logic/symbolGraph/augmentedTracer.ts
 * @stamp {"ts":"2026-02-16T14:20:00Z"}
 * @architectural-role Business Logic
 * @description
 * The core logical tracing engine. Performs a BFS traversal of the symbol graph
 * using the Two-Part Pipe Detection Rule. Structural passthroughs (Pipes) cost 
 * 0 hops, while logic-bearing files cost 1 hop. Enforces a distance-based 
 * resolution gradient. Supports dependency injection for logging to enable batching.
 * 
 * @core-principles
 * 1. ENFORCES the Two-Part Pipe Rule: cost 0 only if (Re-exports AND No Activity).
 * 2. PRIORITIZES distance-based resolution: nearby logic files must be Full Code.
 * 3. SUPPORTS log aggregation via optional external LogBuffer injection.
 * 
 * @api-declaration
 *   export function traceLogicalPath(
 *     graph: SymbolGraph, 
 *     astCache: Map<string, Node>,
 *     startId: string, 
 *     options: TraceOptions,
 *     externalLogger?: LogBuffer
 *   ): TracedNode[];
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { Node } from '@babel/types';
import type { SymbolGraph, TraceOptions, TracedNode, SymbolNode, ResolutionLevel } from './types.js';
import { hasReexports } from './analyzers/barrelDetector.js';
import { hasLogicActivity } from './analyzers/flowAnalyzer.js';
import { LogBuffer } from './logUtils.js';

const PHYSICAL_LIMIT = 150; // Safety boundary for deep physical chains

interface QueueItem {
  node: SymbolNode;
  logicalHops: number;
  physicalDepth: number;
}

/**
 * @id packages/core/src/logic/symbolGraph/augmentedTracer.ts#traceLogicalPath
 * @description
 * Traces the dependency graph using the structural Pipe Detection Rule.
 * accepts an optional `externalLogger` to allow batch-processing of multiple traces
 * without spamming the console with individual flushes.
 */
export function traceLogicalPath(
  graph: SymbolGraph,
  astCache: Map<string, Node>,
  startId: string,
  options: TraceOptions,
  externalLogger?: LogBuffer
): TracedNode[] {
  // Use external logger if provided, otherwise create a local one (auto-flush mode)
  const logger = externalLogger || new LogBuffer('Tracer');
  const isBatchMode = !!externalLogger;

  logger.push(`Starting trace from: ${startId}`);
  if (!isBatchMode) {
    logger.push(`Config: MaxHops=${options.maxHops}, SummaryHops=${options.summaryHops}, Direction=${options.direction}`);
  }

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
    logger.push(`[Warning] No start nodes found for ID: ${startId}`);
    if (!isBatchMode) logger.flush();
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
    // In batch mode, we skip logging every seed to reduce noise
    if (!isBatchMode) logger.push(`[Seed] ${n.filePath}`);
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
      
      // Cost 0 for Pipes (Wormholes), Cost 1 for Logic (Functional Files)
      const cost = isPipe ? 0 : 1;
      const nextLogicalHops = logicalHops + cost;

      // 4. Boundary Enforcement
      if (nextLogicalHops > totalMaxHops) {
        continue;
      }

      // 5. Resolution Assignment (Distance-First Gradient)
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

        // Only log logic nodes or resolution upgrades to keep batch logs clean
        if (isLogic || isResolutionUpgrade) {
           logger.push(
            `[Add] ${neighborPath} | Hops: ${nextLogicalHops} | Res: ${resolution} | Type: ${isLogic ? 'LOGIC' : 'PIPE'}`
          );
        }

        queue.push({
          node: neighborNode,
          logicalHops: nextLogicalHops,
          physicalDepth: physicalDepth + 1,
        });
      }
    }
  }

  // Only flush if we created the logger locally (Single Mode)
  // In Batch Mode, the parent will flush
  if (!isBatchMode) {
    logger.push(`Trace complete. Found ${results.size} unique files.`);
    logger.flush();
  }

  return Array.from(results.values());
}