/**
 * @file packages/core/src/components/hooks/useQueryPanelState/useQueryActions.ts
 * @stamp {"ts":"2026-02-14T16:35:00Z"}
 * @architectural-role State Logic / UI Controller
 * @description
 * Manages the interaction between the Query Panel's UI state and the global 
 * application store. Orchestrates the lifecycle of generation requests, 
 * ensuring the dependency graph is initialized when any tracing threshold (Full or Summary) 
 * is active.
 *
 * @core-principles
 * 1. IS a UI controller responsible for managing side effects.
 * 2. DELEGATES business logic to the queryDiscoveryService.
 * 3. MUST use granular selectors for store interactions.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Updates local feedback state and global store.
 *     state_ownership: none # Operates on state passed via deps.
 *     external_io: none
 */

import { useCallback } from 'react';
import { useSlicerStore } from '../../../state/useSlicerStore';
import { getFilesForPreset } from '../../../logic/presetLogic';
import { discoverContextPaths } from './queryDiscoveryService';
import type { Preset } from '../../../state/slicer-state';
import type { 
  QueryPanelState, 
  QueryPanelActions, 
  UpdateMode 
} from './types';

interface ActionDependencies {
  state: QueryPanelState;
  setError: (val: string) => void;
  setIsLoading: (val: boolean) => void;
  setSuccessMessage: (val: string) => void;
}

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/useQueryActions.ts#useQueryActions
 * @description
 * Hook providing the high-level handlers for the Context Query UI.
 */
export function useQueryActions(deps: ActionDependencies): Pick<QueryPanelActions, 'handleGenerate' | 'handleApplyPreset'> {
  const { state, setError, setIsLoading, setSuccessMessage } = deps;

  // Granular Store Selectors
  const fileIndex = useSlicerStore(s => s.fileIndex);
  const targetedPathsInput = useSlicerStore(s => s.targetedPathsInput);

  // Granular Store Actions
  const setTargetedPathsInput = useSlicerStore(s => s.setTargetedPathsInput);
  const ensureSymbolGraph = useSlicerStore(s => s.ensureSymbolGraph);

  /**
   * Applies a preset's inclusion and exclusion patterns to the targeted pack.
   */
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
  }, [fileIndex, targetedPathsInput, setError, setSuccessMessage, setTargetedPathsInput]);

  /**
   * Triggers the discovery engine and updates the global store with the results.
   */
  const handleGenerate = useCallback(async (mode: UpdateMode) => {
    if (!fileIndex) {
      setError('File index is not available.');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // 1. Ensure the graph is ready if any tracing is requested
      // We check both the inner (Full) and outer (Summary) thresholds
      if (state.traceDepth > 0 || state.summaryTraceDepth > 0) {
        await ensureSymbolGraph();
      }

      // 2. Delegate discovery to the service
      const currentGraph = useSlicerStore.getState().symbolGraph;
      const { paths: discoveredPaths, traceWarning } = await discoverContextPaths(
        fileIndex, 
        currentGraph, 
        state
      );

      // 3. Coordinate Store Update
      let finalPaths: string[];
      if (mode === 'append') {
        const existingPaths = new Set(
          targetedPathsInput.split(',').map(p => p.trim()).filter(Boolean)
        );
        discoveredPaths.forEach(p => existingPaths.add(p));
        finalPaths = Array.from(existingPaths).sort();
      } else {
        finalPaths = discoveredPaths.sort();
      }

      setTargetedPathsInput(finalPaths.join(', '));
      
      // 4. UI Feedback
      const count = discoveredPaths.length;
      const logicalNote = state.traceMode === 'logical' ? ' (Logical)' : '';
      setSuccessMessage(
        `✅ ${mode === 'append' ? 'Appended' : 'Replaced with'} ${count} file(s)${logicalNote}${traceWarning}.`
      );
      setTimeout(() => setSuccessMessage(''), 4000);

    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'An unexpected error occurred.';
      setError(`Generation failed: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, [
    state,
    fileIndex,
    targetedPathsInput,
    ensureSymbolGraph,
    setError,
    setIsLoading,
    setSuccessMessage,
    setTargetedPathsInput
  ]);

  return {
    handleGenerate,
    handleApplyPreset
  };
}