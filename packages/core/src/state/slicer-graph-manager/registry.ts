/**
 * @file packages/core/src/state/slicer-graph-manager/registry.ts
 * @stamp {"ts":"2026-02-16T19:40:00Z"}
 * @architectural-role Business Logic / Librarian
 * @description
 * Provides logic for aggregating and synchronizing semantic metadata results 
 * from background workers into the global application state. Manages the 
 * integrity of the Type, Signature, and Contract libraries.
 *
 * @core-principles
 * 1. PURE LOGIC: MUST NOT perform side effects or direct store mutations.
 * 2. INTEGRITY: ENFORCES consistent mapping of file paths to distilled metadata.
 * 3. EFFICIENCY: Optimized for both single-file patches and bulk merges.
 *
 * @api-declaration
 *   export function updateLibraries(path: string, metadata: DistilledMetadata, libs: RegistryLibs): void;
 *   export function bulkUpdateLibraries(results: WorkerResult[], libs: RegistryLibs): void;
 *
 * @contract
 *   assertions:
 *     purity: mutates-argument # Updates existing Map references for performance.
 *     external_io: none
 */

import type { WorkerResult, DistilledMetadata } from '../../logic/worker/types.js';

/**
 * Container for the three primary semantic registries.
 */
export interface RegistryLibs {
  typeLibrary: Map<string, Record<string, string>>;
  signatureLibrary: Map<string, Record<string, string>>;
  contractLibrary: Map<string, string>;
}

/**
 * @id packages/core/src/state/slicer-graph-manager/registry.ts#updateLibraries
 * @description
 * Updates the semantic libraries for a specific file path using fresh metadata.
 * 
 * @param path - The project-relative path of the file.
 * @param metadata - The distilled metadata returned by the worker.
 * @param libs - The active library maps to update.
 */
export function updateLibraries(
  path: string, 
  metadata: DistilledMetadata, 
  libs: RegistryLibs
): void {
  libs.typeLibrary.set(path, metadata.typeRegistry);
  libs.signatureLibrary.set(path, metadata.syntheticSignatures);
  libs.contractLibrary.set(path, metadata.contractBrief);
}

/**
 * @id packages/core/src/state/slicer-graph-manager/registry.ts#bulkUpdateLibraries
 * @description
 * Consolidates a collection of worker results into the libraries.
 * 
 * @param results - Array of worker results from a bulk indexing operation.
 * @param libs - The active library maps to update.
 */
export function bulkUpdateLibraries(
    results: WorkerResult[], 
    libs: RegistryLibs
  ): void {
    for (const res of results) {
      // res is WorkerResult. res.payload is DistilledMetadata.
      if (res.payload) {
        updateLibraries(res.payload.filePath, res.payload, libs);
      }
    }
  }

/**
 * @id packages/core/src/state/slicer-graph-manager/registry.ts#clearPathFromLibraries
 * @description
 * Removes all semantic metadata associated with a specific path.
 */
export function clearPathFromLibraries(path: string, libs: RegistryLibs): void {
  libs.typeLibrary.delete(path);
  libs.signatureLibrary.delete(path);
  libs.contractLibrary.delete(path);
}