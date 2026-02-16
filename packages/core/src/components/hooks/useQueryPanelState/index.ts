/**
 * @file packages/core/src/components/hooks/useQueryPanelState/index.ts
 * @stamp {"ts":"2026-02-15T16:55:00Z"}
 * @architectural-role Feature Entry Point
 * @description
 * The composition root for the Context Query Panel's logic. Orchestrates the 
 * integration of primitive state, derived selectors, and complex business 
 * actions, including the new resolution reconciliation warnings.
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
    setSummaryTraceDepth,
    setTraceMode,
    setPassiveOutputMode,
    setWildcardQuery,
    setExclusionWildcardQuery,
    setIsLoading,
    setError,
    setSuccessMessage,
    setResolutionWarnings,
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
    setResolutionWarnings,
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
    // Current State (includes resolutionWarnings)
    ...state,
    // Derived View Data
    ...derived,
    // Primitive Setters
    setTraceQuery,
    setTraceDirection,
    setTraceDepth,
    setSummaryTraceDepth,
    setTraceMode,
    setPassiveOutputMode,
    setWildcardQuery,
    setExclusionWildcardQuery,
    setResolutionWarnings,
    // Orchestrated Actions
    handleDocsFolderToggle,
    handleGenerate,
    handleApplyPreset,
  };
}

// Re-export types for external consumption
export * from './types';