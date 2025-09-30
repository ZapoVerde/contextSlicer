// packages/context-slicer-app/src/features/context-slicer/state/zip-path-manager.ts

/**
 * @file packages/context-slicer-app/src/features/context-slicer/state/zip-path-manager.ts
 * @architectural-role State Management / Store Slice / Path Management
 *
 * @description
 * This module encapsulates all the logic for managing the user's currently
 * selected list of file paths for the targeted context pack. This isolates the
 * string manipulation and input synchronization logic.
 *
 * @core-principles
 * 1. **Modularity:** Isolates the state and setter for 'targetedPathsInput'.
 * 2. **Clarity:** Keeps the main store cleaner by abstracting input synchronization.
 */

import type { StateCreator } from 'zustand';
import type { ZipState } from './zip-state';

// --- Slice Definition ---

// Define the shape of the actions this slice provides
export interface PathSlice {
  targetedPathsInput: string;
  setTargetedPathsInput: (paths: string) => void;
}

// createPathSlice conforms to StateCreator, providing typed `set` and `get`
export const createPathSlice: StateCreator<ZipState, [], [], PathSlice> = (set) => ({
  targetedPathsInput: '',

  setTargetedPathsInput: (paths: string) => {
    set({ targetedPathsInput: paths });
  },
});