/**
 * @file packages/core/src/components/hooks/useQueryPanelState/useQueryState.ts
 * @stamp {"ts":"2026-02-14T12:45:00Z"}
 * @architectural-role State Logic
 * @description
 * Manages the primitive UI state for the Context Query Panel. This internal hook 
 * acts as the state container for user inputs, loading status, and UI feedback 
 * messages.
 *
 * @core-principles
 * 1. OWNS the primitive UI state for query parameters.
 * 2. DELEGATES logic and orchestration to sibling hooks.
 * 3. IS NOT responsible for global store synchronization.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Standard React state management.
 *     state_ownership: [traceQuery, traceDirection, traceDepth, ...]
 *     external_io: none
 */

import { useState } from 'react';
import type { TraceMode, PassiveOutputMode } from '../../../logic/symbolGraph/types';
import type { TraceDirection, QueryPanelState } from './types';

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/useQueryState.ts#useQueryState
 * @description
 * Initializes and manages all local state variables required by the Query Panel.
 */
export function useQueryState() {
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

  // Pack the state for easier consumption by the composition root
  const state: QueryPanelState = {
    traceQuery,
    traceDirection,
    traceDepth,
    traceMode,
    passiveOutputMode,
    wildcardQuery,
    exclusionWildcardQuery,
    isLoading,
    error,
    successMessage,
    checkedDocsFolders,
  };

  return {
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
  };
}