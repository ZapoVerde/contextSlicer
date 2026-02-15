/**
 * @file packages/core/src/components/hooks/useQueryPanelState/queryDiscoveryService.ts
 * @stamp {"ts":"2026-02-14T16:10:00Z"}
 * @architectural-role Business Logic
 * @description
 * A pure service that calculates the final set of file paths for a context pack.
 * Encapsulates the logic for seed collection, dual-resolution graph traversal, 
 * and resolution tagging (suffixing paths with :summary).
 *
 * @core-principles
 * 1. IS a framework-agnostic logic engine for file discovery.
 * 2. MUST append :summary to paths designated for semantic extraction.
 * 3. OWNS the coordination of tracing modes and exclusion rules.
 *
 * @api-declaration
 *   export async function discoverContextPaths(
 *     fileIndex: Map<string, FileEntry>,
 *     symbolGraph: SymbolGraph | null,
 *     state: QueryPanelState
 *   ): Promise<{ paths: string[]; traceWarning: string }>;
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { FileEntry } from '../../../state/slicer-state';
import type { SymbolGraph } from '../../../logic/symbolGraph/types';
import { traceSymbolGraph } from '../../../logic/symbolGraph';
import { wildcardToRegExp } from '../../../logic/wildcardUtils';
import { getFilesForCheckedFolders } from '../../../logic/docsFolderLogic';
import { traceLogicalPath } from '../../../logic/symbolGraph/augmentedTracer';
import { buildTemporaryAstCache } from './astUtils';
import type { QueryPanelState } from './types';

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/queryDiscoveryService.ts#discoverContextPaths
 * @description
 * Executes the full discovery pipeline: Seed -> Dual-Resolution Trace -> Sieve.
 */
export async function discoverContextPaths(
  fileIndex: Map<string, FileEntry>,
  symbolGraph: SymbolGraph | null,
  state: QueryPanelState
): Promise<{ paths: string[]; traceWarning: string }> {
  const seedPaths = new Set<string>();
  const allFilePaths = Array.from(fileIndex.keys());
  let traceWarning = '';

  // 1. Gather Seeds: Docs Folders (Defaults to Full Extraction)
  const docFiles = getFilesForCheckedFolders(fileIndex, state.checkedDocsFolders);
  docFiles.forEach(path => seedPaths.add(path));

  // 2. Gather Seeds: Wildcards (Defaults to Full Extraction)
  if (state.wildcardQuery.trim()) {
    const patterns = state.wildcardQuery.split(',').map(p => p.trim()).filter(Boolean);
    for (const pattern of patterns) {
      const regex = wildcardToRegExp(pattern);
      const matches = allFilePaths.filter(p => regex.test(p));
      matches.forEach(m => seedPaths.add(m));
    }
  }

  // 3. Gather Seeds: Trace Start
  if (state.traceQuery) {
    seedPaths.add(state.traceQuery);
  }

  // inclusionPaths stores the final path string with optional resolution suffix
  const inclusionPaths = new Set<string>();
  
  // Seed files are always treated as 'full' (no suffix)
  seedPaths.forEach(p => {
    const pathOnly = p.split('#')[0];
    inclusionPaths.add(pathOnly);
  });

  // 4. Perform Dependency Trace
  const totalHops = Math.max(state.traceDepth, state.summaryTraceDepth);
  if (totalHops > 0 && seedPaths.size > 0) {
    if (symbolGraph) {
      if (state.traceMode === 'logical') {
        const graphFiles = Array.from(symbolGraph.values()).map(n => n.filePath);
        const astCache = await buildTemporaryAstCache(fileIndex, graphFiles);

        for (const startNode of seedPaths) {
          const initialScent = startNode.includes('#') ? startNode.split('#')[1] : undefined;
          
          const tracedNodes = traceLogicalPath(symbolGraph, astCache, startNode, {
            mode: 'logical',
            direction: state.traceDirection,
            maxHops: state.traceDepth,
            summaryHops: state.summaryTraceDepth,
            initialScent
          });

          tracedNodes.forEach(node => {
            const pathWithResolution = node.resolution === 'summary' 
              ? `${node.path}:summary` 
              : node.path;
            
            inclusionPaths.add(pathWithResolution);
          });
        }
      } else {
        // Physical tracing - currently doesn't support dual resolution, defaults to full
        for (const startNode of seedPaths) {
          const tracedPaths = traceSymbolGraph(symbolGraph, startNode, state.traceDirection, state.traceDepth);
          tracedPaths.forEach(p => inclusionPaths.add(p));
        }
      }
    } else {
      traceWarning = ' (Tracing skipped: Graph unavailable)';
    }
  }

  let finalPaths = Array.from(inclusionPaths);

  // 5. Apply Exclusions (Sieve)
  // Exclusions match against the raw path (ignoring resolution suffixes)
  if (state.exclusionWildcardQuery.trim()) {
    const exclusionPatterns = state.exclusionWildcardQuery.split(',').map(p => p.trim()).filter(Boolean);
    const exclusionRegexes = exclusionPatterns.map(wildcardToRegExp);
    
    finalPaths = finalPaths.filter(pathWithFlag => {
      const rawPath = pathWithFlag.split(':')[0];
      return !exclusionRegexes.some(regex => regex.test(rawPath));
    });
  }

  return {
    paths: finalPaths,
    traceWarning
  };
}