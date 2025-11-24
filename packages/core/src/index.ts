/**
 * @file packages/core/src/index.ts
 * @stamp {"ts":"2025-11-24T07:00:00Z"}
 * @architectural-role Feature Entry Point
 *
 * @description
 * The public API barrel file for the @slicer/core package. This file explicitly
 * defines the boundary between the shared core logic and the consuming host
 * applications (Web and Desktop).
 *
 * @core-principles
 * 1. IS the definitive public interface for the core package.
 * 2. MUST explicitly export only the components, hooks, and types intended for consumption.
 * 3. ENFORCES encapsulation by hiding internal implementation details.
 *
 * @contract
 *   assertions:
 *     purity: pure # Re-exports only.
 *     state_ownership: none
 *     external_io: none
 */

// The Main UI Screen
export { default as ContextSlicerScreen } from './ContextSlicerScreen';

// The State Manager (Required for injecting adapters)
export { useSlicerStore } from './state/useSlicerStore';

// Types required for Adapter Implementation
export type { FileSource, FileMetadata } from './types/fileSource';
export type { SlicerConfig } from './state/slicer-state';