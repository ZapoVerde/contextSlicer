/**
 * @file src/features/sourceDump/components/hooks/useQueryPanelState.ts
 * @architectural-role Custom Hook / State & Logic Controller
 */
import { useState, useCallback, useMemo } from 'react';
import { useZipStore } from '../../state/useZipStore';
import { traceSymbolGraph } from '../../logic/symbolGraph';
import { wildcardToRegExp } from '../../logic/wildcardUtils';
import { discoverDocsFolders, getFilesForCheckedFolders } from '../../logic/docsFolderLogic';
// --- THIS IS THE MISSING IMPORT ---
import { getFilesForEnvironmentPreset } from '../../logic/presetLogic';

export type TraceDirection = 'dependencies' | 'dependents' | 'both';
export type UpdateMode = 'append' | 'replace';

export function useQueryPanelState() {
  const { fileIndex, symbolGraph, ensureSymbolGraph, targetedPathsInput, setTargetedPathsInput } =
    useZipStore();

  const [traceQuery, setTraceQuery] = useState<string | null>(null);
  const [traceDirection, setTraceDirection] = useState<TraceDirection>('both');
  const [traceDepth, setTraceDepth] = useState<number>(1);
  const [wildcardQuery, setWildcardQuery] = useState('');
  const [exclusionWildcardQuery, setExclusionWildcardQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [checkedDocsFolders, setCheckedDocsFolders] = useState<Record<string, boolean>>({});

  const docsFolders = useMemo(() => discoverDocsFolders(fileIndex), [fileIndex]);

  const handleDocsFolderToggle = useCallback((folderName: string) => {
    setCheckedDocsFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  }, []);

  // --- THIS IS THE MISSING FUNCTION DEFINITION ---
  const handleApplyEnvironmentPreset = useCallback(() => {
    if (!fileIndex) return;
    const presetFiles = getFilesForEnvironmentPreset(fileIndex);
    const existingPaths = new Set(
      targetedPathsInput.split(',').map(p => p.trim()).filter(Boolean)
    );
    presetFiles.forEach(p => existingPaths.add(p));
    const combinedPaths = Array.from(existingPaths).sort();
    setTargetedPathsInput(combinedPaths.join(', '));
  }, [fileIndex, targetedPathsInput, setTargetedPathsInput]);
  // --- END OF MISSING DEFINITION ---

  const symbolOptions = useMemo(() => {
    if (!symbolGraph) return [];
    const options = new Set<string>(Array.from(symbolGraph.keys()));
    if (fileIndex) {
      fileIndex.forEach((_, key) => options.add(key));
    }
    return Array.from(options).sort();
  }, [symbolGraph, fileIndex]);

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

        const docFiles = getFilesForCheckedFolders(fileIndex, checkedDocsFolders);
        docFiles.forEach(path => seedPaths.add(path));

        if (wildcardQuery.trim()) {
          const patterns = wildcardQuery.split(',').map(p => p.trim()).filter(Boolean);
          for (const pattern of patterns) {
            const regex = wildcardToRegExp(pattern);
            const matches = allFilePaths.filter(p => regex.test(p));
            matches.forEach(m => seedPaths.add(m));
          }
        }

        if (traceQuery) {
          seedPaths.add(traceQuery);
        }

        const inclusionPaths = new Set<string>(
          Array.from(seedPaths).map(p => p.split('#')[0])
        );

        if (traceDepth > 0 && seedPaths.size > 0) {
          await ensureSymbolGraph();
          const graph = useZipStore.getState().symbolGraph;
          if (!graph) {
            throw new Error('Symbol graph is not available for tracing.');
          }

          for (const startNode of seedPaths) {
            const tracedPaths = traceSymbolGraph(graph, startNode, traceDirection, traceDepth);
            tracedPaths.forEach(p => inclusionPaths.add(p));
          }
        }

        let finalPaths = Array.from(inclusionPaths);

        if (exclusionWildcardQuery.trim()) {
          const exclusionPatterns = exclusionWildcardQuery.split(',').map(p => p.trim()).filter(Boolean);
          const exclusionRegexes = exclusionPatterns.map(wildcardToRegExp);
          
          finalPaths = finalPaths.filter(path => 
            !exclusionRegexes.some(regex => regex.test(path))
          );
        }

        const newPathsArray = finalPaths;
        let combinedPaths: string[];

        if (mode === 'append') {
          const existingPaths = new Set(
            targetedPathsInput.split(',').map(p => p.trim()).filter(Boolean)
          );
          newPathsArray.forEach(p => existingPaths.add(p));
          combinedPaths = Array.from(existingPaths).sort();
        } else {
          combinedPaths = newPathsArray.sort();
        }

        setTargetedPathsInput(combinedPaths.join(', '));
        setSuccessMessage(
          `✅ ${mode === 'append' ? 'Appended' : 'Replaced with'} ${newPathsArray.length} file(s).`
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

    // State setters
    setTraceQuery,
    setTraceDirection,
    setTraceDepth,
    setWildcardQuery,
    setExclusionWildcardQuery,
    handleDocsFolderToggle,
    
    // Actions
    handleGenerate,
    handleApplyEnvironmentPreset, // Now this is correctly defined before being returned
  };
}