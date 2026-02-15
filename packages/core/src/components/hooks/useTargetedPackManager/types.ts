/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/types.ts
 * @stamp {"ts":"2026-02-15T11:00:00Z"}
 * @architectural-role Type Definition
 * @description
 * Internal type definitions for the Targeted Pack Manager subsystem. Defines the 
 * interfaces for targeting logic, pre-flight AST results, and the combined 
 * hook state.
 * 
 * @core-principles
 * 1. IS the single source of truth for internal pack management schemas.
 * 2. ENFORCES consistency between the parsing services and the assembly engine.
 * 3. MUST remain platform-agnostic to support testing of assembly logic.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { File } from '@babel/types';

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/types.ts#TargetResolution
 * @description Defines whether a file is included with its full source or as a summary.
 */
export type TargetResolution = 'full' | 'summary';

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/types.ts#TargetedPath
 * @description Represents a file path selected for inclusion and its resolution level.
 */
export interface TargetedPath {
  path: string;
  resolution: TargetResolution;
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/types.ts#PreFlightResult
 * @description The result of the parallel load-and-parse phase for a single file.
 */
export interface PreFlightResult {
  path: string;
  content: string;
  ast: File | null;
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/types.ts#PackManagerState
 * @description The UI state and statistics managed by the pack manager.
 */
export interface PackManagerState {
  isReady: boolean;
  isStale: boolean;
  canExport: boolean;
  targetedPathsInput: string;
  selectedCount: number;
  approxTokens: string;
  preambleOnly: boolean;
  docblocksOnly: boolean;
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/types.ts#PackManagerActions
 * @description The set of user-invocable actions for the pack manager.
 */
export interface PackManagerActions {
  setTargetedPathsInput: (paths: string) => void;
  setPreambleOnly: (val: boolean) => void;
  setDocblocksOnly: (val: boolean) => void;
  handleCopyToClipboard: () => Promise<void>;
  handleDownloadTxt: () => Promise<void>;
  handleDownloadZip: () => Promise<void>;
  handleCopyTreeOnly: () => Promise<void>;
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/types.ts#TargetedPackHookResult
 * @description The final object returned by the useTargetedPackManager hook.
 */
export type TargetedPackHookResult = PackManagerState & PackManagerActions;