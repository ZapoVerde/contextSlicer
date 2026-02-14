/**
 * @file packages/core/src/components/hooks/useQueryPanelState/useDerivedSelectors.ts
 * @stamp {"ts":"2026-02-14T12:55:00Z"}
 * @architectural-role State Logic
 * @description
 * Handles the selection of global state from the SlicerStore and the derivation 
 * of UI-specific data like symbol autocomplete options and documentation folder 
 * structures.
 *
 * @core-principles
 * 1. IS responsible for granular state selection and memoization.
 * 2. MUST use primitive selectors to prevent unnecessary re-renders.
 * 3. OWNS the derivation of UI options from the project index.
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
import type { QueryPanelDerivedState, QueryPanelState } from './types';

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/useDerivedSelectors.ts#useDerivedSelectors
 * @description
 * Computes the derived view-model state for the Query Panel based on the current 
 * file index and internal panel inputs.
 * 
 * @param panelState - The current local state of the Query Panel.
 */
export function useDerivedSelectors(panelState: QueryPanelState): QueryPanelDerivedState {
  // Granular Zustand Selectors
  const fileIndex = useSlicerStore(s => s.fileIndex);
  const symbolGraph = useSlicerStore(s => s.symbolGraph);
  const graphStatus = useSlicerStore(s => s.graphStatus);
  const resolutionErrors = useSlicerStore(s => s.resolutionErrors);
  const slicerConfig = useSlicerStore(s => s.slicerConfig);

  // Derived: Documentation Folders
  const docsFolders = useMemo(() => {
    return discoverDocsFolders(fileIndex);
  }, [fileIndex]);

  // Derived: Symbol Autocomplete Options
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

  // Derived: Configuration-based data
  const presets = useMemo(() => {
    return slicerConfig?.presets ?? [];
  }, [slicerConfig]);

  const isReady = fileIndex !== null;

  // Derived: Validation for Generation
  const canGenerate = useMemo(() => {
    const hasTraceSeed = !!panelState.traceQuery;
    const hasWildcard = !!panelState.wildcardQuery.trim();
    const hasDocsSelected = Object.values(panelState.checkedDocsFolders).some(v => v);
    
    return isReady && (hasTraceSeed || hasWildcard || hasDocsSelected);
  }, [
    isReady, 
    panelState.traceQuery, 
    panelState.wildcardQuery, 
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