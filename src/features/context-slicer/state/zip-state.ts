/**
 * @file src/features/context-slicer/state/zip-state.ts
 * @stamp {"ts":"2025-10-03T01:11:00Z"}
 * @architectural-role State Management / Data Model Definition
 *
 * @description
 * This file defines the canonical TypeScript interfaces for the Context Slicer's
 * state and initializes the base state object. It is the single source of truth
 * for the application's data shape, ensuring type safety and consistency across
 * all features and logic modules. It now also includes types and state properties
 * for managing the application's external YAML configuration.
 *
 * @contract
 * - MUST define and export all core data structures (e.g., `DumpManifest`, `FileEntry`, `SlicerConfig`).
 * - All other state management modules MUST import their types from this file.
 * - The `initialState` object defined here MUST represent a clean, default
 *   state for the application.
 */

import JSZip from 'jszip';
import type { SymbolGraph } from '../logic/symbolGraph';

// --- Type Definitions ---

export interface ManifestGroup {
  name: string;
  originalPath: string;
  fileCount: number;
  bytes?: number;
  txtUrl?: string;
  zipUrl?: string;
  b64Url?: string;
}

export interface DumpManifest {
  generatedAt: string;
  dumpBase: string;
  concatTxt: string;
  concatZip?: string;
  foldersBase: string;
  groups: ManifestGroup[];
  // --- START OF DYNAMIC ALIAS INTEGRATION (Data Model) ---
  // Add the aliasMap to the client-side manifest definition. This ensures
  // that the state manager can correctly parse and store the authoritative
  // alias map provided by the build script.
  aliasMap: Record<string, string>;
  // --- END OF DYNAMIC ALIAS INTEGRATION (Data Model) ---
}

export type FileEntry = {
  path: string;
  size: number;
  getText: () => Promise<string>;
  getUint8: () => Promise<Uint8Array>;
};

export type SkippedFileReason = 'INVALID_EXTENSION' | 'IGNORED_PATH' | 'TOO_LARGE';

export interface SkippedFile {
  path: string;
  reason: SkippedFileReason;
}

export interface SanitationReport {
  processedCount: number;
  skippedCount: number;
  skippedFiles: SkippedFile[];
}

type ZipStatus = 'idle' | 'loading' | 'ready' | 'error';
type SourceType = 'none' | 'dev' | 'zip';
type GraphStatus = 'idle' | 'building' | 'ready' | 'error';

// --- START OF CHANGE: New Config Types ---
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
// --- END OF CHANGE ---

export interface ZipState {
  zipInstance: JSZip | null;
  fileIndex: Map<string, FileEntry> | null;
  manifest: DumpManifest | null;
  status: ZipStatus;
  source: SourceType;
  error: string | null;
  targetedPathsInput: string;
  symbolGraph: SymbolGraph | null;
  graphStatus: GraphStatus;
  sanitationReport: SanitationReport | null;
  resolutionErrors: string[];
  // --- START OF CHANGE: Add slicerConfig to state ---
  slicerConfig: SlicerConfig | null;
  // --- END OF CHANGE ---

  // Actions will be injected later
  loadFromDevServer: (retryCount?: number) => Promise<void>;
  loadZipFile: (file: File) => Promise<void>;
  reset: () => void;
  setTargetedPathsInput: (paths: string) => void;
  ensureSymbolGraph: () => Promise<void>;
  // --- START OF CHANGE: Add loadConfig action signature ---
  loadConfig: () => Promise<void>;
  // --- END OF CHANGE ---
}

// --- Initial State ---
export const initialState: Omit<
  ZipState,
  | 'loadFromDevServer'
  | 'loadZipFile'
  | 'reset'
  | 'setTargetedPathsInput'
  | 'ensureSymbolGraph'
  // --- START OF CHANGE: Add loadConfig to omitted properties ---
  | 'loadConfig'
  // --- END OF CHANGE ---
> = {
  zipInstance: null,
  fileIndex: null,
  manifest: null,
  status: 'idle',
  source: 'none',
  error: null,
  targetedPathsInput: '',
  symbolGraph: null,
  graphStatus: 'idle',
  sanitationReport: null,
  resolutionErrors: [],
  // --- START OF CHANGE: Initialize slicerConfig ---
  slicerConfig: null,
  // --- END OF CHANGE ---
};

// --- Helper Function ---
export function createSyntheticManifest(fileIndex: Map<string, FileEntry>): DumpManifest {
    const groupsMap = new Map<string, { files: FileEntry[]; totalBytes: number }>();
    const add = (folderKey: string, file: FileEntry) => {
      if (!groupsMap.has(folderKey)) {
        groupsMap.set(folderKey, { files: [], totalBytes: 0 });
      }
      const group = groupsMap.get(folderKey)!;
      group.files.push(file);
      group.totalBytes += file.size;
    };
    for (const file of fileIndex.values()) {
      const parts = file.path.split('/');
      if (parts.length === 1) {
        add('', file);
      } else {
        for (let i = 1; i < parts.length; i++) {
          const folder = parts.slice(0, i).join('/');
          add(folder, file);
        }
      }
    }
    const manifestGroups: ManifestGroup[] = Array.from(groupsMap.entries())
      .map(([path, data]) => ({
        name: (path || '(repo root)').replace(/[^\w.\- ()]/g, '_'),
        originalPath: path || '(repo root)',
        fileCount: data.files.length,
        bytes: data.totalBytes,
      }))
      .sort((a, b) => a.originalPath.localeCompare(b.originalPath));
    return {
      generatedAt: new Date().toISOString(),
      dumpBase: '',
      concatTxt: '',
      foldersBase: '',
      groups: manifestGroups,
      // When a user uploads a zip, there's no build process, so we provide an empty alias map.
      aliasMap: {}, 
    };
}