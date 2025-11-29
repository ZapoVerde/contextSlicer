/**
 * @file packages/core/src/components/hooks/useQueryPanelState.tsx
 * @stamp {"ts":"2025-11-28T15:35:00Z"}
 * @architectural-role Custom Hook / State & Logic Controller
 *
 * @description
 * This hook encapsulates all state management and business logic for the
 * "Context Query Tools" panel. It acts as the controller layer, mediating
 * between the UI components (inputs, sliders) and the core application state
 * (FileIndex, SymbolGraph).
 *
 * @core-principles
 * 1. IS the brain of the Query Panel UI, owning all transient form state.
 * 2. ORCHESTRATES complex query operations (tracing, wildcard matching) by delegating to pure logic modules.
 * 3. DECOUPLES the presentation layer (UI components) from the global store implementation.
 * 4. ENFORCES graceful degradation: if the Symbol Graph fails, file selection must still work.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Updates local state and dispatches global store actions.
 *     state_ownership: [traceQuery, traceDirection, wildcardQuery, loadingStatus]
 *     external_io: none
 */

import { useState, useCallback, useMemo } from 'react';
import { useSlicerStore } from '../../state/useSlicerStore';
import type { Preset } from '../../state/slicer-state';
import { traceSymbolGraph } from '../../logic/symbolGraph';
import { wildcardToRegExp } from '../../logic/wildcardUtils';
import { discoverDocsFolders, getFilesForCheckedFolders } from '../../logic/docsFolderLogic';
import { getFilesForPreset } from '../../logic/presetLogic';

export type TraceDirection = 'dependencies' | 'dependents' | 'both';
export type UpdateMode = 'append' | 'replace';

export function useQueryPanelState() {
  // Global State Selectors
  const fileIndex = useSlicerStore((state) => state.fileIndex);
  const symbolGraph = useSlicerStore((state) => state.symbolGraph);
  const graphStatus = useSlicerStore((state) => state.graphStatus);
  const resolutionErrors = useSlicerStore((state) => state.resolutionErrors);
  const ensureSymbolGraph = useSlicerStore((state) => state.ensureSymbolGraph);
  const targetedPathsInput = useSlicerStore((state) => state.targetedPathsInput);
  const setTargetedPathsInput = useSlicerStore((state) => state.setTargetedPathsInput);
  const slicerConfig = useSlicerStore((state) => state.slicerConfig);

  // Local UI State
  const [traceQuery, setTraceQuery] = useState<string | null>(null);
  const [traceDirection, setTraceDirection] = useState<TraceDirection>('both');
  const [traceDepth, setTraceDepth] = useState<number>(1);
  const [wildcardQuery, setWildcardQuery] = useState('');
  const [exclusionWildcardQuery, setExclusionWildcardQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [checkedDocsFolders, setCheckedDocsFolders] = useState<Record<string, boolean>>({});

  // Derived State
  const docsFolders = useMemo(() => discoverDocsFolders(fileIndex), [fileIndex]);

  // Robust Option Generation: Works even if SymbolGraph is broken
  const symbolOptions = useMemo(() => {
    const options = new Set<string>();
    
    // 1. Always available if files are loaded
    if (fileIndex) {
      for (const key of fileIndex.keys()) {
        options.add(key);
      }
    }

    // 2. Only available if graph is healthy
    if (symbolGraph) {
      for (const key of symbolGraph.keys()) {
        options.add(key);
      }
    }
    
    return Array.from(options).sort();
  }, [symbolGraph, fileIndex]);

  const presets = slicerConfig?.presets ?? [];

  // Handlers
  const handleDocsFolderToggle = useCallback((folderName: string) => {
    setCheckedDocsFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  }, []);

  const handleApplyPreset = useCallback((preset: Preset) => {
    if (!fileIndex) {
      setError('File index is not available.');
      return;
    }
    const presetFiles = getFilesForPreset(fileIndex, preset);
    const existingPaths = new Set(
      targetedPathsInput.split(',').map(p => p.trim()).filter(Boolean)
    );
    presetFiles.forEach(p => existingPaths.add(p));
    const combinedPaths = Array.from(existingPaths).sort();
    setTargetedPathsInput(combinedPaths.join(', '));
    setSuccessMessage(`✅ Applied preset: ${preset.name}.`);
    setTimeout(() => setSuccessMessage(''), 4000);
  }, [fileIndex, targetedPathsInput, setTargetedPathsInput]);

  const handleGenerate = useCallback(
    async (mode: UpdateMode) => {
      if (!traceQuery && !wildcardQuery.trim() && Object.values(checkedDocsFolders).every(v => !v)) {
        setError('At least one query input or docs folder must be selected.');
        return;
      }
      if (!fileIndex) {
        setError('File index is not available.');
        return;
      }

      setIsLoading(true);
      setError('');
      setSuccessMessage('');

      try {
        const seedPaths = new Set<string>();
        const allFilePaths = Array.from(fileIndex.keys());

        // 1. Collect from Docs Folders
        const docFiles = getFilesForCheckedFolders(fileIndex, checkedDocsFolders);
        docFiles.forEach(path => seedPaths.add(path));

        // 2. Collect from Wildcards
        if (wildcardQuery.trim()) {
          const patterns = wildcardQuery.split(',').map(p => p.trim()).filter(Boolean);
          for (const pattern of patterns) {
            const regex = wildcardToRegExp(pattern);
            const matches = allFilePaths.filter(p => regex.test(p));
            matches.forEach(m => seedPaths.add(m));
          }
        }

        // 3. Collect from Trace Seed
        if (traceQuery) {
          seedPaths.add(traceQuery);
        }

        const inclusionPaths = new Set<string>(
          Array.from(seedPaths).map(p => p.split('#')[0])
        );

        // 4. Perform Dependency Trace (Graceful Fallback)
        let traceWarning = '';
        if (traceDepth > 0 && seedPaths.size > 0) {
          // Attempt to build graph if not ready
          await ensureSymbolGraph();
          
          // Re-fetch fresh state
          const graph = useSlicerStore.getState().symbolGraph;
          
          if (graph) {
            for (const startNode of seedPaths) {
              const tracedPaths = traceSymbolGraph(graph, startNode, traceDirection, traceDepth);
              tracedPaths.forEach(p => inclusionPaths.add(p));
            }
          } else {
            traceWarning = ' (Tracing skipped: Graph unavailable)';
            console.warn('Symbol graph unavailable. Only seed files included.');
          }
        }

        let finalPaths = Array.from(inclusionPaths);

        // 5. Apply Exclusions
        if (exclusionWildcardQuery.trim()) {
          const exclusionPatterns = exclusionWildcardQuery.split(',').map(p => p.trim()).filter(Boolean);
          const exclusionRegexes = exclusionPatterns.map(wildcardToRegExp);
          
          finalPaths = finalPaths.filter(path => 
            !exclusionRegexes.some(regex => regex.test(path))
          );
        }

        // 6. Commit to Global State
        let combinedPaths: string[];

        if (mode === 'append') {
          const existingPaths = new Set(
            targetedPathsInput.split(',').map(p => p.trim()).filter(Boolean)
          );
          finalPaths.forEach(p => existingPaths.add(p));
          combinedPaths = Array.from(existingPaths).sort();
        } else {
          combinedPaths = finalPaths.sort();
        }

        setTargetedPathsInput(combinedPaths.join(', '));
        setSuccessMessage(
          `✅ ${mode === 'append' ? 'Appended' : 'Replaced with'} ${finalPaths.length} file(s)${traceWarning}.`
        );
        setTimeout(() => setSuccessMessage(''), 4000);
      } catch (e: unknown) {
        if (e instanceof Error) {
          setError(e.message);
        } else {
          setError('An unknown error occurred.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      wildcardQuery,
      traceQuery,
      traceDirection,
      traceDepth,
      exclusionWildcardQuery,
      checkedDocsFolders,
      fileIndex,
      ensureSymbolGraph,
      setTargetedPathsInput,
      targetedPathsInput,
    ]
  );

  return {
    // State values
    traceQuery,
    traceDirection,
    traceDepth,
    wildcardQuery,
    isLoading,
    error,
    successMessage,
    symbolOptions,
    isReady: fileIndex !== null,
    canGenerate: !!traceQuery || !!wildcardQuery.trim() || Object.values(checkedDocsFolders).some(v => v),
    exclusionWildcardQuery,
    docsFolders,
    checkedDocsFolders,
    presets,
    graphStatus,
    resolutionErrors,

    // State setters
    setTraceQuery,
    setTraceDirection,
    setTraceDepth,
    setWildcardQuery,
    setExclusionWildcardQuery,
    handleDocsFolderToggle,
    
    // Actions
    handleGenerate,
    handleApplyPreset,
  };
}