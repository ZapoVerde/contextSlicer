/**
 * @file packages/core/src/state/slicer-state.ts
 * @stamp {"ts":"2026-02-16T22:35:00Z"}
 * @architectural-role Type Definition
 * @description 
 * Defines the canonical state shape and initial values for the Context Slicer store.
 * Now expanded to include high-performance semantic registries for pre-computed 
 * type closures, synthetic signatures, and structural contract briefs.
 * 
 * @core-principles
 * 1. IS the single source of truth for the application's reactive state.
 * 2. MUST remain pure and free of logic.
 * 3. ENFORCES architectural consistency between the background engine and the UI.
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { SymbolGraph, ResolutionLevel } from '../logic/symbolGraph/types.js';
import type { WorkerPool } from '../logic/worker/WorkerPool.js';

/**
 * @id packages/core/src/state/slicer-state.ts#Preset
 * @description Defines a reusable query configuration for file selection.
 */
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

/**
 * @id packages/core/src/state/slicer-state.ts#SlicerConfig
 * @description Root configuration schema for the application.
 */
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
 * @description Represents a file within the application's memory with lazy content loading.
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
 * @description The root state interface for the Zustand store.
 */
export interface SlicerState {
  // Data Source
  fileIndex: Map<string, FileEntry> | null;
  slicerConfig: SlicerConfig | null;
  activeAdapter: import('../types/fileSource.js').FileSource | null;

  // App Status
  status: SlicerStatus;
  source: SourceType;
  error: string | null;
  
  // Distributed Engine State
  workerPool: WorkerPool | null;

  // Semantically Distilled Context (The Dictionary)
  /** Aggregated registry of type definitions: FilePath -> { SymbolName -> Source } */
  typeLibrary: Map<string, Record<string, string>>;
  /** Aggregated registry of synthetic signatures: FilePath -> { SymbolName -> Source } */
  signatureLibrary: Map<string, Record<string, string>>;
  /** Aggregated registry of structural contract summaries: FilePath -> BriefText */
  contractLibrary: Map<string, string>;

  // Derived Data
  symbolGraph: SymbolGraph | null;
  graphStatus: GraphStatus;
  sanitationReport: SanitationReport | null;
  resolutionErrors: string[];

  // Optimistic Assembly State
  isAssembling: boolean;
  assembledPackText: string | null;
  accurateTokenCount: number | null;

  // User Input
  targetedPathsInput: string;
  
  // Actions
  setTargetedPathsInput: (paths: string) => void;
  /** Full background build of the dependency graph and semantic libraries */
  ensureSymbolGraph: () => Promise<void>;
  /** Incremental background update for a single changed file */
  patchGraphNode: (path: string) => Promise<void>;
  
  /** Triggers the background assembly of the context pack */
  orchestrateAssembly: (
    targets: Array<{ path: string; resolution: ResolutionLevel }>,
    options: { docblocksOnly: boolean; includeBoundaryLibrary: boolean }
  ) => Promise<void>;

  setFileSource: (source: import('../types/fileSource.js').FileSource, sourceType: SourceType) => Promise<void>;
  updateConfig: (newConfig: SlicerConfig) => Promise<void>;
  reset: () => void;
}

export const initialState: Omit<
  SlicerState,
  | 'setTargetedPathsInput' 
  | 'ensureSymbolGraph' 
  | 'patchGraphNode' 
  | 'setFileSource' 
  | 'updateConfig' 
  | 'reset'
  | 'orchestrateAssembly'
> = {
  fileIndex: null,
  slicerConfig: null,
  activeAdapter: null,
  status: 'idle',
  source: 'none',
  error: null,
  workerPool: null,
  
  // Dictionary Initial State
  typeLibrary: new Map(),
  signatureLibrary: new Map(),
  contractLibrary: new Map(),

  symbolGraph: null,
  graphStatus: 'idle',
  sanitationReport: null,
  resolutionErrors: [],
  targetedPathsInput: '',
  
  // Optimistic Assembly Defaults
  isAssembling: false,
  assembledPackText: null,
  accurateTokenCount: null,
};