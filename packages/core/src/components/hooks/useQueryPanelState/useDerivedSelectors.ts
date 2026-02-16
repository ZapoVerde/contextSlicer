/**
 * @file packages/core/src/components/hooks/useQueryPanelState/useDerivedSelectors.ts
 * @stamp {"ts":"2026-02-16T14:10:00Z"}
 * @architectural-role State Logic
 * @description
 * Handles the selection of global state and the derivation of UI-specific data.
 * Optimized with input debouncing to ensure that expensive validation and 
 * autocomplete calculations do not impact typing performance.
 *
 * @core-principles
 * 1. IS responsible for granular state selection and memoization.
 * 2. MUST use debounced inputs for heavy derivations to maintain UI fluidity.
 * 3. OWNS the mapping of the project index to autocomplete suggestions.
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     state_ownership: none
 *     external_io: none
 */

import { useMemo } from 'react';
import { useSlicerStore } from '../../../state/useSlicerStore';
import { discoverDocsFolders } from '../../../logic/docsFolderLogic';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import type { QueryPanelDerivedState, QueryPanelState } from './types';

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/useDerivedSelectors.ts#useDerivedSelectors
 * @description
 * Computes the derived view-model state for the Query Panel. Uses temporal 
 * decoupling (debouncing) for user-entered queries to prevent jank.
 * 
 * @param panelState - The current raw local state of the Query Panel.
 */
export function useDerivedSelectors(panelState: QueryPanelState): QueryPanelDerivedState {
  // 1. Granular Zustand Selectors (Reactive)
  const fileIndex = useSlicerStore(s => s.fileIndex);
  const symbolGraph = useSlicerStore(s => s.symbolGraph);
  const graphStatus = useSlicerStore(s => s.graphStatus);
  const resolutionErrors = useSlicerStore(s => s.resolutionErrors);
  const slicerConfig = useSlicerStore(s => s.slicerConfig);

  // 2. Debounce highly volatile inputs (Typing)
  // We wait 300ms after the user stops typing before recalculating valid/invalid states.
  const debouncedTraceQuery = useDebouncedValue(panelState.traceQuery, 300);
  const debouncedWildcardQuery = useDebouncedValue(panelState.wildcardQuery, 300);

  // 3. Derived: Documentation Folders
  const docsFolders = useMemo(() => {
    return discoverDocsFolders(fileIndex);
  }, [fileIndex]);

  // 4. Derived: Symbol Autocomplete Options
  // This is a heavy calculation (sorting potentially thousands of keys).
  // It is memoized strictly on the index/graph, so typing won't trigger it.
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

  // 5. Derived: Configuration-based data
  const presets = useMemo(() => {
    return slicerConfig?.presets ?? [];
  }, [slicerConfig]);

  const isReady = fileIndex !== null;

  // 6. Derived: Validation for Generation
  // Uses debounced values to prevent the "Generate" buttons from flickering/updating 
  // until the user has paused typing.
  const canGenerate = useMemo(() => {
    const hasTraceSeed = !!debouncedTraceQuery;
    const hasWildcard = !!debouncedWildcardQuery.trim();
    const hasDocsSelected = Object.values(panelState.checkedDocsFolders).some(v => v);
    
    return isReady && (hasTraceSeed || hasWildcard || hasDocsSelected);
  }, [
    isReady, 
    debouncedTraceQuery, 
    debouncedWildcardQuery, 
    panelState.checkedDocsFolders
  ]);

  return {
    docsFolders,
    symbolOptions,
    presets,
    isReady,
    canGenerate,
    graphStatus,
    resolutionErrors,
  };
}