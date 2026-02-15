/**
 * @file packages/core/src/logic/symbolGraph/augmentedTracer.ts
 * @stamp {"ts":"2026-02-14T17:50:00Z"}
 * @architectural-role Business Logic
 * @description
 * The core logical tracing engine. Performs a BFS traversal of the symbol graph,
 * applying a dual-resolution gradient. Structural files (barrels/pipes) are 
 * automatically summarized, while logic-bearing files are extracted in full or 
 * summarized based on their logical distance from the seed.
 * 
 * @core-principles
 * 1. IS responsible for multi-resolution graph traversal.
 * 2. ENFORCES the "Autosummarize" rule for structural passthroughs regardless of depth.
 * 3. OWNS the transition logic between 'full' and 'summary' resolution levels.
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

import type { SymbolGraph, TraceOptions, TracedNode, SymbolNode, ResolutionLevel } from './types';
import { isBarrelFile } from './analyzers/barrelDetector';
import { analyzeFlow } from './analyzers/flowAnalyzer';

const PHYSICAL_LIMIT = 100; // Hard limit to prevent runaway loops in deep logical chains

interface QueueItem {
  node: SymbolNode;
  logicalHops: number;
  physicalDepth: number;
  currentScent: string;
}

/**
 * @id packages/core/src/logic/symbolGraph/augmentedTracer.ts#traceLogicalPath
 * @description
 * Traces the dependency graph using logical hop counting with dual-resolution output.
 * Now includes detailed console logging for debugging.
 */
export function traceLogicalPath(
  graph: SymbolGraph,
  astCache: Map<string, any>,
  startId: string,
  options: TraceOptions
): TracedNode[] {
  console.groupCollapsed(`[Tracer] Starting trace from ${startId}`);
  console.log('Options:', options);

  const startNodes = new Set<SymbolNode>();
  const initialScent = options.initialScent || '';
  const totalMaxHops = Math.max(options.maxHops, options.summaryHops);

  // 1. Resolve starting points
  if (startId.includes('#')) {
    const node = graph.get(startId);
    if (node) startNodes.add(node);
  } else {
    graph.forEach(node => {
      if (node.filePath === startId) startNodes.add(node);
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
    currentScent: initialScent || (node.symbolName === '(file)' ? '' : node.symbolName)
  }));

  const minLogicalHops = new Map<string, number>();
  const results = new Map<string, TracedNode>();

  // Initialize seed nodes
  startNodes.forEach(n => {
    minLogicalHops.set(n.id, 0);
    results.set(n.filePath, {
      path: n.filePath,
      status: 'meaningful',
      resolution: 'full', // Seeds are always full extraction targets
      scent: initialScent,
      depth: 0
    });
    console.log(`[Seed] ${n.filePath}`);
  });

  let head = 0;
  while (head < queue.length) {
    const { node, logicalHops, physicalDepth, currentScent } = queue[head++];

    if (logicalHops >= totalMaxHops || physicalDepth >= PHYSICAL_LIMIT) {
      continue;
    }

    // Determine neighbors
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
      let debugReason = 'Standard Link';

      // 3. Logical Flow & Scent Analysis
      if (options.mode === 'logical' && ast) {
        if (isBarrelFile(ast)) {
          cost = 0;
          isMeaningful = false;
          debugReason = 'Barrel File';
        } else if (currentScent) {
          const flow = analyzeFlow(ast, currentScent);
          cost = flow.isMeaningful ? 1 : 0;
          isMeaningful = flow.isMeaningful;
          nextScent = flow.nextIdentifier;
          debugReason = flow.reason;
        } else {
          // No scent to follow, fallback to physical-like behavior
          debugReason = 'No Scent (Physical fallback)';
        }
      }

      const nextLogicalHops = logicalHops + cost;

      // 4. Resolution Assignment (The Gradient Rule)
      let resolution: ResolutionLevel = 'summary';
      
      if (!isMeaningful) {
        resolution = 'summary'; // Rule: Passthroughs/Barrels are ALWAYS summarized
      } else if (nextLogicalHops <= options.maxHops) {
        resolution = 'full';
      } else if (nextLogicalHops <= options.summaryHops) {
        resolution = 'summary';
      } else {
        // Logging skipped items helps understand why the graph stops growing
        // console.log(`[Skip] ${neighborPath} (Hops: ${nextLogicalHops} > Limit: ${options.summaryHops})`);
        continue; // Outside logical bounds
      }

      // 5. Cheap-Path BFS Update
      const prevMin = minLogicalHops.get(neighborId);
      
      // We update if we found a shorter path, OR if we found a path of equal length
      // that upgrades the resolution (e.g., from summary to full).
      if (nextLogicalHops <= totalMaxHops && (prevMin === undefined || nextLogicalHops <= prevMin)) {
        
        const existing = results.get(neighborPath);
        const isResolutionUpgrade = existing && existing.resolution === 'summary' && resolution === 'full';
        const isShorterPath = prevMin === undefined || nextLogicalHops < prevMin;

        if (isShorterPath || isResolutionUpgrade) {
          minLogicalHops.set(neighborId, nextLogicalHops);
          
          results.set(neighborPath, {
            path: neighborPath,
            status: isMeaningful ? 'meaningful' : 'passive',
            resolution,
            scent: nextScent,
            depth: nextLogicalHops
          });

          console.log(`[Add] ${neighborPath} | Depth: ${nextLogicalHops} | Type: ${resolution} | Reason: ${debugReason}`);

          queue.push({
            node: neighborNode,
            logicalHops: nextLogicalHops,
            physicalDepth: physicalDepth + 1,
            currentScent: nextScent
          });
        }
      }
    }
  }

  console.log(`[Tracer] Trace complete. Found ${results.size} unique files.`);
  console.groupEnd();
  
  return Array.from(results.values());
}