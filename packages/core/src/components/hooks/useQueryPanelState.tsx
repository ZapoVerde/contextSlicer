/**
 * @file packages/core/src/components/hooks/useQueryPanelState.tsx
 * @stamp {"ts":"2026-02-14T08:20:00Z"}
 * @architectural-role State Logic
 * @description
 * Manages the state and business logic for the Context Query Panel.
 * Orchestrates the execution of both legacy physical traces and the new 
 * logical/scent-sensitive traces. Handles on-demand AST parsing for the 
 * logical tracer.
 * 
 * @core-principles
 * 1. OWNS the UI state for tracing parameters (modes, hops, scent).
 * 2. ORCHESTRATES the logical tracing workflow, including AST generation.
 * 3. DECOUPLES the UI from the specific tracing algorithms.
 * 
 * @contract
 *   assertions:
 *     purity: mutates # Updates local state and global store
 *     state_ownership: [traceMode, passiveOutputMode, ...others]
 *     external_io: none
 */

import { useState, useCallback, useMemo } from 'react';
import * as parser from '@babel/parser';
import { useSlicerStore } from '../../state/useSlicerStore';
import type { Preset } from '../../state/slicer-state';
import { traceSymbolGraph } from '../../logic/symbolGraph';
import { wildcardToRegExp } from '../../logic/wildcardUtils';
import { discoverDocsFolders, getFilesForCheckedFolders } from '../../logic/docsFolderLogic';
import { getFilesForPreset } from '../../logic/presetLogic';
import { traceLogicalPath } from '../../logic/symbolGraph/augmentedTracer';
import type { TraceMode, PassiveOutputMode } from '../../logic/symbolGraph/types';

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
  const [traceMode, setTraceMode] = useState<TraceMode>('logical');
  const [passiveOutputMode, setPassiveOutputMode] = useState<PassiveOutputMode>('meta');
  
  const [wildcardQuery, setWildcardQuery] = useState('');
  const [exclusionWildcardQuery, setExclusionWildcardQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [checkedDocsFolders, setCheckedDocsFolders] = useState<Record<string, boolean>>({});

  // Derived State
  const docsFolders = useMemo(() => discoverDocsFolders(fileIndex), [fileIndex]);

  // Robust Option Generation
  const symbolOptions = useMemo(() => {
    const options = new Set<string>();
    if (fileIndex) {
      for (const key of fileIndex.keys()) {
        options.add(key);
      }
    }
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

  /**
   * Helper to parse ASTs on demand for logical tracing.
   * This avoids storing ASTs in the global store but ensures the tracer has what it needs.
   */
  const buildTemporaryAstCache = async (files: string[]) => {
    const cache = new Map<string, any>();
    if (!fileIndex) return cache;

    const parsePromises = files.map(async (path) => {
      const entry = fileIndex.get(path);
      if (entry && /\.(ts|tsx|js|jsx)$/.test(path)) {
        try {
          const content = await entry.getText();
          const ast = parser.parse(content, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
            errorRecovery: true,
          });
          cache.set(path, ast);
        } catch (e) {
          console.warn(`Failed to parse ${path} for logical trace`, e);
        }
      }
    });

    await Promise.all(parsePromises);
    return cache;
  };

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

        // 4. Perform Dependency Trace
        let traceWarning = '';
        if (traceDepth > 0 && seedPaths.size > 0) {
          await ensureSymbolGraph();
          const graph = useSlicerStore.getState().symbolGraph;
          
          if (graph) {
            // LOGICAL TRACE MODE
            if (traceMode === 'logical') {
              // Pre-parse potentially relevant files (heuristic: all files in graph, or just index?)
              // For accuracy, we parse all graph files. For 500 files this is fast. 
              // Optimization: We could optimize this, but strict correctness requires ASTs.
              const graphFiles = Array.from(graph.values()).map(n => n.filePath);
              const astCache = await buildTemporaryAstCache(graphFiles);

              for (const startNode of seedPaths) {
                // Determine initial scent from the seed string (e.g. "file.ts#User")
                const initialScent = startNode.includes('#') ? startNode.split('#')[1] : undefined;
                
                const tracedNodes = traceLogicalPath(graph, astCache, startNode, {
                  mode: 'logical',
                  direction: traceDirection,
                  maxHops: traceDepth,
                  initialScent
                });

                // Apply Passive Output Filter
                tracedNodes.forEach(node => {
                  if (node.status === 'meaningful') {
                    inclusionPaths.add(node.path);
                  } else {
                    // It's passive. Check the output mode.
                    if (passiveOutputMode === 'full') {
                      inclusionPaths.add(node.path);
                    } 
                    // If 'meta' or 'docblock', we essentially "exclude" it from the 
                    // primary file list, effectively bypassing it in the text dump.
                    // Future: We could add these to a separate "metadata" list if the UI supported it.
                  }
                });
              }

            } else {
              // LEGACY / PHYSICAL MODE
              for (const startNode of seedPaths) {
                const tracedPaths = traceSymbolGraph(graph, startNode, traceDirection, traceDepth);
                tracedPaths.forEach(p => inclusionPaths.add(p));
              }
            }
          } else {
            traceWarning = ' (Tracing skipped: Graph unavailable)';
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
        
        const count = finalPaths.length;
        const logicalNote = traceMode === 'logical' ? ' (Logical)' : '';
        setSuccessMessage(
          `✅ ${mode === 'append' ? 'Appended' : 'Replaced with'} ${count} file(s)${logicalNote}${traceWarning}.`
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
      traceMode,
      passiveOutputMode,
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
    traceMode,
    passiveOutputMode,
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
    setTraceMode,
    setPassiveOutputMode,
    setWildcardQuery,
    setExclusionWildcardQuery,
    handleDocsFolderToggle,
    
    // Actions
    handleGenerate,
    handleApplyPreset,
  };
}