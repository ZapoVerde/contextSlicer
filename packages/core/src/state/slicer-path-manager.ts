/**
 * @file packages/core/src/state/slicer-path-manager.ts
 * @stamp {"ts":"2025-11-24T07:00:00Z"}
 * @architectural-role State Management
 *
 * @description
 * This module encapsulates the logic for managing the user's text input for
 * the targeted context pack. It isolates the string manipulation logic from
 * the complex file processing logic.
 *
 * @core-principles
 * 1. OWNS the `targetedPathsInput` string state.
 * 2. IS the single source of truth for the user's manual selection in the UI.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Updates the global store state.
 *     state_ownership: [targetedPathsInput]
 *     external_io: none
 */

import type { StateCreator } from 'zustand';
import type { SlicerState } from './slicer-state';

export interface PathSlice {
  targetedPathsInput: string;
  setTargetedPathsInput: (paths: string) => void;
}

export const createPathSlice: StateCreator<SlicerState, [], [], PathSlice> = (set) => ({
  targetedPathsInput: '',

  setTargetedPathsInput: (paths: string) => {
    set({ targetedPathsInput: paths });
  },
});