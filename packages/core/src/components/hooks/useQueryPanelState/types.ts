/**
 * @file packages/core/src/components/hooks/useQueryPanelState/types.ts
 * @stamp {"ts":"2026-02-15T16:15:00Z"}
 * @architectural-role Type Definition
 * @description
 * Defines the shared types, interfaces, and state shapes for the Context Query 
 * Panel's logic layer. Updated to support dual-resolution ticker state and 
 * non-fatal resolution warnings (conflicts).
 * 
 * @core-principles
 * 1. IS the single source of truth for query-related types.
 * 2. ENFORCES consistency between the state hooks and the UI components.
 * 3. MUST remain pure and free of logic.
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { TraceMode, PassiveOutputMode } from '../../../logic/symbolGraph/types';
import type { Preset } from '../../../state/slicer-state';

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/types.ts#QueryPanelPreset
 * @description Alias for the system-level Preset type, scoped to the Query Panel.
 */
export type QueryPanelPreset = Preset;

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/types.ts#TraceDirection
 * @description Directionality of the dependency traversal.
 */
export type TraceDirection = 'dependencies' | 'dependents' | 'both';

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/types.ts#UpdateMode
 * @description Strategy for updating the targeted paths list.
 */
export type UpdateMode = 'append' | 'replace';

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/types.ts#QueryPanelState
 * @description The raw UI state managed within the panel.
 */
export interface QueryPanelState {
  traceQuery: string | null;
  traceDirection: TraceDirection;
  /** Inner threshold for Full Extraction */
  traceDepth: number;
  /** Outer threshold for Summary extraction */
  summaryTraceDepth: number;
  traceMode: TraceMode;
  passiveOutputMode: PassiveOutputMode;
  wildcardQuery: string;
  exclusionWildcardQuery: string;
  isLoading: boolean;
  error: string;
  successMessage: string;
  /** Non-fatal warnings about resolution conflicts (e.g., path requested as both Full and Summary) */
  resolutionWarnings: string[];
  checkedDocsFolders: Record<string, boolean>;
}

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/types.ts#QueryPanelDerivedState
 * @description State computed from the file index or global configuration.
 */
export interface QueryPanelDerivedState {
  docsFolders: string[];
  symbolOptions: readonly string[];
  presets: QueryPanelPreset[];
  isReady: boolean;
  canGenerate: boolean;
  /** The current health status of the global dependency graph build. */
  graphStatus: 'idle' | 'building' | 'ready' | 'error';
  /** Fatal or structural errors from the global graph builder. */
  resolutionErrors: string[];
}

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/types.ts#QueryPanelActions
 * @description Handlers and setters exposed to the UI components.
 */
export interface QueryPanelActions {
  setTraceQuery: (val: string | null) => void;
  setTraceDirection: (val: TraceDirection) => void;
  setTraceDepth: (val: number) => void;
  setSummaryTraceDepth: (val: number) => void;
  setTraceMode: (val: TraceMode) => void;
  setPassiveOutputMode: (val: PassiveOutputMode) => void;
  setWildcardQuery: (val: string) => void;
  setExclusionWildcardQuery: (val: string) => void;
  setResolutionWarnings: (val: string[]) => void;
  handleDocsFolderToggle: (folderName: string) => void;
  handleGenerate: (mode: UpdateMode) => Promise<void>;
  handleApplyPreset: (preset: QueryPanelPreset) => void;
}

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/types.ts#QueryPanelHookResult
 * @description The combined API returned by the useQueryPanelState hook.
 */
export type QueryPanelHookResult = QueryPanelState & QueryPanelDerivedState & QueryPanelActions;