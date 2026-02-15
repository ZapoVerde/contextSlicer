/**
 * @file packages/core/src/components/hooks/useQueryPanelState/queryDiscoveryService.ts
 * @stamp {"ts":"2026-02-15T16:10:00Z"}
 * @architectural-role Business Logic
 * @description
 * A pure service that calculates the final set of file paths for a context pack.
 * Encapsulates the logic for seed collection, dual-resolution graph traversal, 
 * and resolution reconciliation. It detects and warns about conflicting 
 * instructions (e.g., a file targeted as both Full and Summary).
 *
 * @core-principles
 * 1. IS a framework-agnostic logic engine for file discovery.
 * 2. MUST identify and warn about conflicting resolution instructions for the same path.
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
 * Reconciliation & Sieve. Identifies resolution conflicts between seeds and traces.
 */
export async function discoverContextPaths(
  fileIndex: Map<string, FileEntry>,
  symbolGraph: SymbolGraph | null,
  state: QueryPanelState
): Promise<{ paths: string[]; traceWarning: string; resolutionWarnings: string[] }> {
  const allFilePaths = Array.from(fileIndex.keys());
  let traceWarning = '';

  /**
   * instructionMap: Handles silent de-duplication of exact instruction strings.
   * Key: "path" or "path:summary"
   * Value: ResolutionLevel
   */
  const instructionMap = new Map<string, ResolutionLevel>();

  /**
   * identityMap: Tracks all requested resolutions for a physical path to detect conflicts.
   * Key: "path"
   * Value: Set of ResolutionLevels
   */
  const identityMap = new Map<string, Set<ResolutionLevel>>();

  const addInstruction = (path: string, resolution: ResolutionLevel) => {
    const rawPath = path.split(':')[0]; // Sanity check for incoming strings
    const instruction = resolution === 'summary' ? `${rawPath}:summary` : rawPath;

    // Silent de-duplication of the instruction string
    instructionMap.set(instruction, resolution);

    // Track resolutions per physical identity
    const resolutionSet = identityMap.get(rawPath) ?? new Set<ResolutionLevel>();
    resolutionSet.add(resolution);
    identityMap.set(rawPath, resolutionSet);
  };

  // 1. Gather Seeds: Docs Folders (Defaults to Full Extraction)
  const docFiles = getFilesForCheckedFolders(fileIndex, state.checkedDocsFolders);
  docFiles.forEach(path => addInstruction(path, 'full'));

  // 2. Gather Seeds: Wildcards (Defaults to Full Extraction)
  if (state.wildcardQuery.trim()) {
    const patterns = state.wildcardQuery.split(',').map(p => p.trim()).filter(Boolean);
    for (const pattern of patterns) {
      const regex = wildcardToRegExp(pattern);
      const matches = allFilePaths.filter(p => regex.test(p));
      matches.forEach(m => addInstruction(m, 'full'));
    }
  }

  // 3. Gather Seeds: Trace Start
  if (state.traceQuery) {
    const startPath = state.traceQuery.split('#')[0];
    addInstruction(startPath, 'full');
  }

  // 4. Perform Dependency Trace
  const totalHops = Math.max(state.traceDepth, state.summaryTraceDepth);
  if (totalHops > 0 && (state.traceQuery || docFiles.length > 0 || state.wildcardQuery.trim())) {
    if (symbolGraph) {
      if (state.traceMode === 'logical') {
        const graphFiles = Array.from(symbolGraph.values()).map(n => n.filePath);
        const astCache = await buildTemporaryAstCache(fileIndex, graphFiles);

        // We trace from every unique physical path currently in our identity map
        for (const startPath of identityMap.keys()) {
          const tracedNodes = traceLogicalPath(symbolGraph, astCache, startPath, {
            mode: 'logical',
            direction: state.traceDirection,
            maxHops: state.traceDepth,
            summaryHops: state.summaryTraceDepth,
          });

          tracedNodes.forEach(node => {
            addInstruction(node.path, node.resolution);
          });
        }
      } else {
        // Physical tracing fallback
        for (const startPath of identityMap.keys()) {
          const tracedPaths = traceSymbolGraph(symbolGraph, startPath, state.traceDirection, state.traceDepth);
          tracedPaths.forEach(p => addInstruction(p, 'full'));
        }
      }
    } else {
      traceWarning = ' (Tracing skipped: Graph unavailable)';
    }
  }

  // 5. Generate Resolution Warnings (Conflict Detection)
  const resolutionWarnings: string[] = [];
  identityMap.forEach((resolutions, path) => {
    if (resolutions.size > 1) {
      resolutionWarnings.push(
        `Conflict: '${path}' is targeted as both Full and Summary. Both will be processed.`
      );
    }
  });

  let finalInstructions = Array.from(instructionMap.keys());

  // 6. Apply Exclusions (Sieve)
  // Exclusions match against the physical path part of the instruction
  if (state.exclusionWildcardQuery.trim()) {
    const exclusionPatterns = state.exclusionWildcardQuery.split(',').map(p => p.trim()).filter(Boolean);
    const exclusionRegexes = exclusionPatterns.map(wildcardToRegExp);
    
    finalInstructions = finalInstructions.filter(instruction => {
      const rawPath = instruction.split(':')[0];
      return !exclusionRegexes.some(regex => regex.test(rawPath));
    });
  }

  return {
    paths: finalInstructions,
    traceWarning,
    resolutionWarnings
  };
}