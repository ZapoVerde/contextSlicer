/**
 * @file packages/core/src/components/hooks/useQueryPanelState/useQueryState.ts
 * @stamp {"ts":"2026-02-15T01:00:00Z"}
 * @architectural-role State Logic
 * @description
 * Manages the primitive UI state for the Context Query Panel. This internal hook 
 * acts as the state container for user inputs, including the dual-resolution 
 * thresholds (traceDepth and summaryTraceDepth), loading status, and feedback.
 *
 * @core-principles
 * 1. OWNS the primitive UI state for query parameters.
 * 2. DELEGATES logic and orchestration to sibling hooks.
 * 3. IS NOT responsible for global store synchronization.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Standard React state management.
 *     state_ownership: [traceQuery, traceDirection, traceDepth, summaryTraceDepth, ...]
 *     external_io: none
 */

import { useState } from 'react';
import type { TraceMode, PassiveOutputMode } from '../../../logic/symbolGraph/types';
import type { TraceDirection, QueryPanelState } from './types';

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/useQueryState.ts#useQueryState
 * @description
 * Initializes and manages all local state variables required by the Query Panel.
 * Defaults are set to provide a tight initial context gradient (1:2).
 */
export function useQueryState() {
  const [traceQuery, setTraceQuery] = useState<string | null>(null);
  const [traceDirection, setTraceDirection] = useState<TraceDirection>('both');
  
  // Resolution Boundaries
  // Defaulting to 1 hop for Full Extraction (Seed + Direct Neighbors)
  const [traceDepth, setTraceDepth] = useState<number>(1);
  // Defaulting to 2 hops for Summary extraction (Distant Neighbors)
  const [summaryTraceDepth, setSummaryTraceDepth] = useState<number>(2);
  
  const [traceMode, setTraceMode] = useState<TraceMode>('logical');
  const [passiveOutputMode, setPassiveOutputMode] = useState<PassiveOutputMode>('meta');
  
  const [wildcardQuery, setWildcardQuery] = useState('');
  const [exclusionWildcardQuery, setExclusionWildcardQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [checkedDocsFolders, setCheckedDocsFolders] = useState<Record<string, boolean>>({});

  // Construct state object matching the QueryPanelState interface
  const state: QueryPanelState = {
    traceQuery,
    traceDirection,
    traceDepth,
    summaryTraceDepth,
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
    setSummaryTraceDepth,
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