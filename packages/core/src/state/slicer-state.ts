/**
 * @file packages/core/src/state/slicer-state.ts
 * @stamp 2025-11-24T06:05:00Z
 * @architectural-role Type Definition
 * @description Defines the canonical state shape for the Context Slicer application.
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { SymbolGraph } from '../logic/symbolGraph/types.js';

// Re-export SlicerConfig related types for use in FileSource
export interface Preset {
  id: string;
  name: string;
  category: string;
  summary: string;
  rationale: string;
  useCases: string[];
  patterns: string[];
  exclusions: string[];
}

export interface SlicerConfig {
  version: number;
  project: {
    targetProjectRoot: string;
  };
  sanitation: {
    maxUploadSizeMb: number;
    acceptedExtensions: string[];
    denyPatterns: string[];
  };
  presets: Preset[];
  sanitationOverrides: {
    mandatoryInclusions: string[];
  };
  output: {
    beginMarker: string;
    endMarker: string;
  };
  liveDevelopment: {
    watchDebounceMs: number;
    staleRefetchDelayMs: number;
  };
}

/**
 * @id packages/core/src/state/slicer-state.ts#FileEntry
 * @description
 * Represents a file within the application's memory.
 * Unlike the legacy version which bound directly to JSZip, this version delegates
 * data fetching to the abstract FileSource.
 */
export interface FileEntry {
  path: string;
  size: number;
  /** Lazily fetches text content via the active FileSource */
  getText: () => Promise<string>;
  /** Lazily fetches binary content via the active FileSource */
  getUint8: () => Promise<Uint8Array>;
}

export type SlicerStatus = 'idle' | 'loading' | 'ready' | 'error';
export type SourceType = 'none' | 'api' | 'zip';
export type GraphStatus = 'idle' | 'building' | 'ready' | 'error';

export interface SkippedFile {
  path: string;
  reason: 'INVALID_EXTENSION' | 'IGNORED_PATH' | 'TOO_LARGE';
}

export interface SanitationReport {
  processedCount: number;
  skippedCount: number;
  skippedFiles: SkippedFile[];
}

/**
 * @id packages/core/src/state/slicer-state.ts#SlicerState
 * @description
 * The root state interface for the Zustand store.
 */
export interface SlicerState {
  // Data Source
  fileIndex: Map<string, FileEntry> | null;
  slicerConfig: SlicerConfig | null;
  
  /**
   * The currently active data adapter instance.
   * Retained in state to allow writing config changes back to the source.
   */
  activeAdapter: import('../types/fileSource.js').FileSource | null;

  // App Status
  status: SlicerStatus;
  source: SourceType;
  error: string | null;
  
  // Derived Data
  symbolGraph: SymbolGraph | null;
  graphStatus: GraphStatus;
  sanitationReport: SanitationReport | null; // Mostly for Web/Zip mode
  resolutionErrors: string[];

  // User Input
  targetedPathsInput: string;
  
  // Actions
  setTargetedPathsInput: (paths: string) => void;
  ensureSymbolGraph: () => Promise<void>;
  
  setFileSource: (source: import('../types/fileSource.js').FileSource, sourceType: SourceType) => Promise<void>;
  
  /**
   * Updates the configuration in the store and attempts to persist it via the active adapter.
   */
  updateConfig: (newConfig: SlicerConfig) => Promise<void>;
  
  reset: () => void;
}

export const initialState: Omit<
  SlicerState,
  'setTargetedPathsInput' | 'ensureSymbolGraph' | 'setFileSource' | 'updateConfig' | 'reset'
> = {
  fileIndex: null,
  slicerConfig: null,
  activeAdapter: null, // Initialize as null
  status: 'idle',
  source: 'none',
  error: null,
  targetedPathsInput: '',
  symbolGraph: null,
  graphStatus: 'idle',
  sanitationReport: null,
  resolutionErrors: [],
};