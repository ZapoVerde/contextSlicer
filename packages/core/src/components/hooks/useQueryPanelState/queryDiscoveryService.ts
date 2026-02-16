/**
 * @file packages/core/src/components/hooks/useQueryPanelState/queryDiscoveryService.ts
 * @stamp {"ts":"2026-02-16T14:35:00Z"}
 * @architectural-role Business Logic
 * @description
 * A pure service that calculates the final set of file paths for a context pack.
 * Optimized with a shared LogBuffer to aggregate discovery telemetry from 
 * documentation folders, wildcards, and dependency traces into a single flush.
 *
 * @core-principles
 * 1. IS a framework-agnostic logic engine for file discovery.
 * 2. MUST reconcile conflicting resolution instructions (Full > Summary).
 * 3. OPTIMIZES diagnostic observability via batch-buffered logging.
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
import { LogBuffer } from '../../../logic/symbolGraph/logUtils';
import type { QueryPanelState } from './types';

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/queryDiscoveryService.ts#discoverContextPaths
 * @description
 * Executes the full discovery pipeline with consolidated batch logging.
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
   * identityMap: Tracks all requested resolutions for a physical path.
   * Key: "src/file.ts" (Raw Physical Path)
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
    logger.push(`[Seeds] Added ${docFiles.length} files from docs folders.`);
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
      logger.push(`[Seeds] Wildcard '${pattern}' matched ${matches.length} files.`);
      matches.forEach(m => {
        addRequest(m, 'full');
        seedPaths.add(m);
      });
    }
  }

  // 3. Gather Seeds: Trace Start
  if (state.traceQuery) {
    const startPath = state.traceQuery.split('#')[0];
    logger.push(`[Seeds] Trace entry point: ${startPath}`);
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

        logger.push(`[Trace] Starting logical trace for ${seedPaths.size} seeds...`);
        for (const startPath of Array.from(seedPaths)) {
          // Pass the shared logger to augmentedTracer to aggregate logs
          const tracedNodes = traceLogicalPath(symbolGraph, astCache, startPath, {
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
        logger.push(`[Trace] Starting physical fallback trace...`);
        for (const startPath of Array.from(seedPaths)) {
          const tracedPaths = traceSymbolGraph(symbolGraph, startPath, state.traceDirection, state.traceDepth);
          tracedPaths.forEach(p => addRequest(p, 'full'));
        }
      }
    } else {
      traceWarning = ' (Tracing skipped: Graph unavailable)';
      logger.push('[Warning] Symbol graph unavailable. Tracing skipped.');
    }
  }

  // 5. Reconciliation & Warning Generation
  const resolutionWarnings: string[] = [];
  const finalInstructions: string[] = [];

  identityMap.forEach((resolutions, rawPath) => {
    if (resolutions.has('full') && resolutions.has('summary')) {
      resolutionWarnings.push(
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
      const isExcluded = exclusionRegexes.some(regex => regex.test(rawPath));
      if (isExcluded) {
        logger.push(`[Sieve] Excluded: ${rawPath}`);
      }
      return !isExcluded;
    });
  }

  logger.push(`Discovery complete. Instructions generated for ${filteredInstructions.length} files.`);
  logger.flush();

  return {
    paths: filteredInstructions,
    traceWarning,
    resolutionWarnings
  };
}