/**
 * @file packages/core/src/components/hooks/useQueryPanelState/queryDiscoveryService.ts
 * @stamp {"ts":"2026-02-16T15:10:00Z"}
 * @architectural-role Business Logic
 * @description
 * A pure service that calculates the final set of file paths for a context pack.
 * Optimized for speed by utilizing pre-computed structural metadata in the 
 * SymbolGraph, completely bypassing main-thread AST parsing.
 *
 * @core-principles
 * 1. PERFORMANCE: MUST achieve near-instant execution by avoiding I/O and parsing.
 * 2. RECONCILIATION: ENFORCES the "Full > Summary" resolution priority.
 * 3. OBSERVABILITY: Uses buffered logging to provide diagnostic transparency.
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
import { LogBuffer } from '../../../logic/symbolGraph/logUtils';
import type { QueryPanelState } from './types';

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/queryDiscoveryService.ts#discoverContextPaths
 * @description
 * Executes the file discovery pipeline. Optimized to use embedded graph metadata.
 */
export async function discoverContextPaths(
  fileIndex: Map<string, FileEntry>,
  symbolGraph: SymbolGraph | null,
  state: QueryPanelState
): Promise<{ paths: string[]; traceWarning: string; resolutionWarnings: string[] }> {
  const logger = new LogBuffer('DiscoveryService');
  const allFilePaths = Array.from(fileIndex.keys());
  let traceWarning = '';

  /**
   * identityMap: Tracks requested resolutions for physical paths.
   * Key: "src/file.ts" (Physical Path)
   */
  const identityMap = new Map<string, Set<ResolutionLevel>>();

  const addRequest = (path: string, resolution: ResolutionLevel) => {
    const rawPath = path.split(':')[0]; 
    const resolutionSet = identityMap.get(rawPath) ?? new Set<ResolutionLevel>();
    resolutionSet.add(resolution);
    identityMap.set(rawPath, resolutionSet);
  };

  const seedPaths = new Set<string>();

  // 1. Gather Seeds: Docs Folders
  const docFiles = getFilesForCheckedFolders(fileIndex, state.checkedDocsFolders);
  if (docFiles.length > 0) {
    docFiles.forEach(path => {
      addRequest(path, 'full');
      seedPaths.add(path);
    });
  }

  // 2. Gather Seeds: Wildcards
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

  // 3. Gather Seeds: Trace Entry
  if (state.traceQuery) {
    const startPath = state.traceQuery.split('#')[0];
    addRequest(startPath, 'full');
    seedPaths.add(startPath);
  }

  // 4. Perform Dependency Trace (O(1) Flag Lookup)
  const totalHops = Math.max(state.traceDepth, state.summaryTraceDepth);
  
  if (totalHops > 0 && seedPaths.size > 0) {
    if (symbolGraph) {
      if (state.traceMode === 'logical') {
        // PERFORMANCE FIX: traceLogicalPath no longer requires astCache.
        // It relies on SymbolNode.hasLogicActivity / hasReexports.
        for (const startPath of Array.from(seedPaths)) {
          const tracedNodes = traceLogicalPath(symbolGraph, startPath, {
            mode: 'logical',
            direction: state.traceDirection,
            maxHops: state.traceDepth,
            summaryHops: state.summaryTraceDepth,
          }, logger);

          tracedNodes.forEach(node => {
            addRequest(node.path, node.resolution);
          });
        }
      } else {
        // Physical fallback
        for (const startPath of Array.from(seedPaths)) {
          const tracedPaths = traceSymbolGraph(symbolGraph, startPath, state.traceDirection, state.traceDepth);
          tracedPaths.forEach(p => addRequest(p, 'full'));
        }
      }
    } else {
      traceWarning = ' (Tracing skipped: Graph unavailable)';
      logger.push('[Warning] Symbol graph unavailable. Trace skipped.');
    }
  }

  // 5. Reconciliation (Full beats Summary)
  const reconciliationWarnings: string[] = [];
  const finalInstructions: string[] = [];

  identityMap.forEach((resolutions, rawPath) => {
    if (resolutions.has('full') && resolutions.has('summary')) {
      reconciliationWarnings.push(
        `Conflict: '${rawPath}' targeted as both Full and Summary. Defaulting to Full.`
      );
    }

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

  logger.push(`Discovery complete. Instructions: ${filteredInstructions.length}`);
  logger.flush();

  return {
    paths: filteredInstructions,
    traceWarning,
    resolutionWarnings: reconciliationWarnings
  };
}