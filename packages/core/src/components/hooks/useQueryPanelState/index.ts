/**
 * @file packages/core/src/components/hooks/useQueryPanelState/index.ts
 * @stamp {"ts":"2026-02-14T13:20:00Z"}
 * @architectural-role Feature Entry Point
 * @description
 * The composition root for the Context Query Panel's logic. It orchestrates 
 * the integration of primitive state, derived view-models, and complex 
 * business actions.
 *
 * @core-principles
 * 1. IS the public entry point for the Query Panel's headless logic.
 * 2. ORCHESTRATES the lifecycle and communication between modular sub-hooks.
 * 3. ENFORCES the Headless Logic Pattern by returning a standardized state/action API.
 *
 * @api-declaration
 *   export function useQueryPanelState(): QueryPanelHookResult;
 *
 * @contract
 *   assertions:
 *     purity: mutates # Composes hooks that manage state and side effects.
 *     state_ownership: none # Delegates to internal hooks.
 *     external_io: none
 */

import { useCallback } from 'react';
import { useQueryState } from './useQueryState';
import { useDerivedSelectors } from './useDerivedSelectors';
import { useQueryActions } from './useQueryActions';
import type { QueryPanelHookResult } from './types';

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/index.ts#useQueryPanelState
 * @description
 * The authoritative hook for managing Context Slicer query logic. 
 * Combines state, derived data, and actions into a single reactive object.
 */
export function useQueryPanelState(): QueryPanelHookResult {
  // 1. Initialize primitive state container
  const {
    state,
    setTraceQuery,
    setTraceDirection,
    setTraceDepth,
    setTraceMode,
    setPassiveOutputMode,
    setWildcardQuery,
    setExclusionWildcardQuery,
    setIsLoading,
    setError,
    setSuccessMessage,
    setCheckedDocsFolders,
  } = useQueryState();

  // 2. Compute derived view-model (Selectors)
  const derived = useDerivedSelectors(state);

  // 3. Initialize complex business actions
  const { handleGenerate, handleApplyPreset } = useQueryActions({
    state,
    setError,
    setIsLoading,
    setSuccessMessage,
  });

  // 4. Specialized Toggle Handler
  const handleDocsFolderToggle = useCallback((folderName: string) => {
    setCheckedDocsFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName],
    }));
  }, [setCheckedDocsFolders]);

  // 5. Final API Composition
  return {
    // Current State
    ...state,
    // Derived View Data
    ...derived,
    // Primitive Setters
    setTraceQuery,
    setTraceDirection,
    setTraceDepth,
    setTraceMode,
    setPassiveOutputMode,
    setWildcardQuery,
    setExclusionWildcardQuery,
    // Orchestrated Actions
    handleDocsFolderToggle,
    handleGenerate,
    handleApplyPreset,
  };
}

// Re-export types for external consumption if needed
export * from './types';