/**
 * @file packages/core/src/types/fileSource.ts
 * @stamp 2025-11-24T16:30:00Z
 * @architectural-role Type Definition
 * @description
 * Defines the abstract interface for data retrieval and persistence. This abstraction
 * allows the core application to operate identically whether data is coming from a
 * local zip file (Web) or a live file system watcher (Desktop).
 *
 * @core-principles
 * 1. IS the boundary between the Core Logic and the Platform implementation.
 * 2. MUST be implemented by platform-specific adapters.
 * 3. DECOUPLES the application state from specific data loading mechanisms.
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { SlicerConfig } from '../state/slicer-state.js';

/**
 * @id packages/core/src/types/fileSource.ts#FileMetadata
 * @description
 * Minimal metadata required by the application to index a file.
 */
export interface FileMetadata {
  /** The relative path of the file (e.g., "src/main.ts") */
  path: string;
  /** The size of the file in bytes, used for token estimation */
  size: number;
}

/**
 * @id packages/core/src/types/fileSource.ts#FileSource
 * @description
 * The adapter interface that must be implemented by the hosting environment (Web or Desktop).
 * It provides access to configuration, file lists, and file contents.
 */
export interface FileSource {
  /**
   * Retrieves the initial application configuration.
   */
  getConfig(): Promise<SlicerConfig>;

  /**
   * Persists updated configuration back to the source.
   * @param config The new configuration object to save.
   */
  saveConfig(config: SlicerConfig): Promise<void>;

  /**
   * Retrieves the list of all available files with their metadata.
   * Used to build the initial file index.
   */
  getFileList(): Promise<FileMetadata[]>;

  /**
   * Lazily retrieves the text content of a specific file.
   * @param path The relative path of the file.
   */
  getFileContent(path: string): Promise<string>;

  /**
   * Lazily retrieves the binary content of a specific file.
   * Required for generating download zips.
   * @param path The relative path of the file.
   */
  getFileBuffer(path: string): Promise<Uint8Array>;
}