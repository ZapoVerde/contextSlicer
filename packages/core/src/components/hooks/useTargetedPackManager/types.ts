/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/types.ts
 * @stamp {"ts":"2026-02-16T17:00:00Z"}
 * @architectural-role Type Definition
 * @description
 * Defines the canonical data structures and state shapes for the Targeted Pack 
 * Manager subsystem. Encapsulates targeting logic, pre-flight results, and 
 * the unified hook API.
 * 
 * @core-principles
 * 1. IS the single source of truth for internal pack management schemas.
 * 2. ENFORCES architectural consistency between the parsing services and the assembly engine.
 * 3. MUST remain platform-agnostic to support multi-environment execution (Web/Desktop).
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { File } from '@babel/types';

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/types.ts#TargetResolution
 * @description Defines whether a file is included with its full source or as a summary brief.
 */
export type TargetResolution = 'full' | 'summary';

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/types.ts#TargetedPath
 * @description Represents a specific file path selected for inclusion and its resolution level.
 */
export interface TargetedPath {
  /** The project-relative path to the file. */
  path: string;
  /** The extraction depth requested for this specific file. */
  resolution: TargetResolution;
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/types.ts#PreFlightResult
 * @description The result of the parallel load-and-parse phase for a single file.
 */
export interface PreFlightResult {
  /** The project-relative path of the file. */
  path: string;
  /** The raw text content retrieved from the source. */
  content: string;
  /** The parsed Babel AST node, or null if parsing failed. */
  ast: File | null;
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/types.ts#PackManagerState
 * @description The UI state, statistics, and background status managed by the pack manager.
 */
export interface PackManagerState {
  /** True if a project source is loaded and ready for extraction. */
  isReady: boolean;
  /** True if the loaded source has changed since the last pack generation. */
  isStale: boolean;
  /** True if all conditions (ready, not stale, targets exist, not assembling) are met for export. */
  canExport: boolean;
  /** The raw, comma-separated string of paths from the text input. */
  targetedPathsInput: string;
  /** The number of files currently recognized in the selection. */
  selectedCount: number;
  /** A formatted string representing the estimated or accurate token count. */
  approxTokens: string;
  /** True if the current token count is derived from actual Tiktoken BPE analysis. */
  isAccurate: boolean;
  /** True if a background assembly job (Trigger 2) is currently in progress. */
  isAssembling: boolean;
  /** If true, the assembly engine will only output the spatial file tree. */
  preambleOnly: boolean;
  /** If true, the assembly engine will only extract JSDoc/Preamble blocks. */
  docblocksOnly: boolean;
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/types.ts#PackManagerActions
 * @description The set of user-invocable actions for managing and exporting context packs.
 */
export interface PackManagerActions {
  /** Updates the raw path input string. */
  setTargetedPathsInput: (paths: string) => void;
  /** Toggles the 'Tree Only' extraction mode. */
  setPreambleOnly: (val: boolean) => void;
  /** Toggles the 'Docblocks Only' extraction mode. */
  setDocblocksOnly: (val: boolean) => void;
  /** Asynchronously copies the current pre-built pack to the system clipboard. */
  handleCopyToClipboard: () => Promise<void>;
  /** Asynchronously triggers a browser download of the current pack as a .txt file. */
  handleDownloadTxt: () => Promise<void>;
  /** Asynchronously gathers and downloads all targeted files as a .zip archive. */
  handleDownloadZip: () => Promise<void>;
  /** Generates and copies only the spatial file tree to the clipboard. */
  handleCopyTreeOnly: () => Promise<void>;
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/types.ts#TargetedPackHookResult
 * @description The combined API object returned by the useTargetedPackManager hook.
 */
export type TargetedPackHookResult = PackManagerState & PackManagerActions;