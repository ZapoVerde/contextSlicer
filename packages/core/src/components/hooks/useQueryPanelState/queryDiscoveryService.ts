/**
 * @file packages/core/src/components/hooks/useQueryPanelState/queryDiscoveryService.ts
 * @stamp {"ts":"2026-02-15T22:05:00Z"}
 * @architectural-role Business Logic
 * @description
 * A pure service that calculates the final set of file paths for a context pack.
 * Encapsulates the logic for seed collection, dual-resolution graph traversal, 
 * and resolution reconciliation. It enforces a "Highest Resolution Wins" policy 
 * for output generation while detecting and warning about internal conflicts.
 *
 * @core-principles
 * 1. IS a framework-agnostic logic engine for file discovery.
 * 2. MUST reconcile conflicting resolution instructions (Full > Summary).
 * 3. OWNS the coordination of tracing modes and exclusion rules.
 *
 * @api-declaration
 *   export async function discoverContextPaths(
 *     fileIndex: Map<string, FileEntry>,
 *     symbolGraph: SymbolGraph | null,
 *     state: QueryPanelState
 *   ): Promise<{ paths: string[]; traceWarning: string; resolutionWarnings: string[] }>;
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { FileEntry } from '../../../state/slicer-state';
import type { SymbolGraph, ResolutionLevel } from '../../../logic/symbolGraph/types';
import { traceSymbolGraph } from '../../../logic/symbolGraph';
import { wildcardToRegExp } from '../../../logic/wildcardUtils';
import { getFilesForCheckedFolders } from '../../../logic/docsFolderLogic';
import { traceLogicalPath } from '../../../logic/symbolGraph/augmentedTracer';
import { buildTemporaryAstCache } from './astUtils';
import type { QueryPanelState } from './types';

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/queryDiscoveryService.ts#discoverContextPaths
 * @description
 * Executes the full discovery pipeline: Seed Collection -> Dual-Resolution Trace -> 
 * Reconciliation & Sieve. Identifies resolution conflicts between seeds and traces, 
 * and collapses them into the highest priority instruction.
 */
export async function discoverContextPaths(
  fileIndex: Map<string, FileEntry>,
  symbolGraph: SymbolGraph | null,
  state: QueryPanelState
): Promise<{ paths: string[]; traceWarning: string; resolutionWarnings: string[] }> {
  const allFilePaths = Array.from(fileIndex.keys());
  let traceWarning = '';

  /**
   * identityMap: Tracks all requested resolutions for a physical path.
   * Key: "src/file.ts" (Raw Physical Path)
   * Value: Set of requested resolutions {'full', 'summary'}
   */
  const identityMap = new Map<string, Set<ResolutionLevel>>();

  const addRequest = (path: string, resolution: ResolutionLevel) => {
    // Ensure we are working with the clean physical path
    const rawPath = path.split(':')[0]; 
    const resolutionSet = identityMap.get(rawPath) ?? new Set<ResolutionLevel>();
    resolutionSet.add(resolution);
    identityMap.set(rawPath, resolutionSet);
  };

  // We explicitly track "Seeds" separately. 
  // Seeds are the entry points for the trace.
  const seedPaths = new Set<string>();

  // 1. Gather Seeds: Docs Folders (Defaults to Full Extraction)
  const docFiles = getFilesForCheckedFolders(fileIndex, state.checkedDocsFolders);
  docFiles.forEach(path => {
    addRequest(path, 'full');
    seedPaths.add(path);
  });

  // 2. Gather Seeds: Wildcards (Defaults to Full Extraction)
  if (state.wildcardQuery.trim()) {
    const patterns = state.wildcardQuery.split(',').map(p => p.trim()).filter(Boolean);
    for (const pattern of patterns) {
      const regex = wildcardToRegExp(pattern);
      const matches = allFilePaths.filter(p => regex.test(p));
      matches.forEach(m => {
        addRequest(m, 'full');
        seedPaths.add(m);
      });
    }
  }

  // 3. Gather Seeds: Trace Start
  if (state.traceQuery) {
    const startPath = state.traceQuery.split('#')[0];
    addRequest(startPath, 'full');
    seedPaths.add(startPath);
  }

  // 4. Perform Dependency Trace
  const totalHops = Math.max(state.traceDepth, state.summaryTraceDepth);
  
  if (totalHops > 0 && seedPaths.size > 0) {
    if (symbolGraph) {
      if (state.traceMode === 'logical') {
        const graphFiles = Array.from(symbolGraph.values()).map(n => n.filePath);
        const astCache = await buildTemporaryAstCache(fileIndex, graphFiles);

        for (const startPath of Array.from(seedPaths)) {
          const tracedNodes = traceLogicalPath(symbolGraph, astCache, startPath, {
            mode: 'logical',
            direction: state.traceDirection,
            maxHops: state.traceDepth,
            summaryHops: state.summaryTraceDepth,
          });

          tracedNodes.forEach(node => {
            // Add discovered node resolution to the map
            addRequest(node.path, node.resolution);
          });
        }
      } else {
        // Physical tracing fallback (Legacy support)
        for (const startPath of Array.from(seedPaths)) {
          const tracedPaths = traceSymbolGraph(symbolGraph, startPath, state.traceDirection, state.traceDepth);
          tracedPaths.forEach(p => addRequest(p, 'full'));
        }
      }
    } else {
      traceWarning = ' (Tracing skipped: Graph unavailable)';
    }
  }

  // 5. Reconciliation & Warning Generation
  const resolutionWarnings: string[] = [];
  const finalInstructions: string[] = [];

  identityMap.forEach((resolutions, rawPath) => {
    // A. Detect Conflicts (Seed vs Trace or Depth Overlap)
    if (resolutions.has('full') && resolutions.has('summary')) {
      resolutionWarnings.push(
        `Conflict: '${rawPath}' targeted as both Full and Summary. Defaulting to Full.`
      );
    }

    // B. Generate Output (Highest Resolution Wins: Full > Summary)
    if (resolutions.has('full')) {
      finalInstructions.push(rawPath);
    } else if (resolutions.has('summary')) {
      finalInstructions.push(`${rawPath}:summary`);
    }
  });

  // 6. Apply Exclusions (Sieve)
  let filteredInstructions = finalInstructions;
  if (state.exclusionWildcardQuery.trim()) {
    const exclusionPatterns = state.exclusionWildcardQuery.split(',').map(p => p.trim()).filter(Boolean);
    const exclusionRegexes = exclusionPatterns.map(wildcardToRegExp);
    
    filteredInstructions = finalInstructions.filter(instruction => {
      const rawPath = instruction.split(':')[0];
      return !exclusionRegexes.some(regex => regex.test(rawPath));
    });
  }

  return {
    paths: filteredInstructions,
    traceWarning,
    resolutionWarnings
  };
}