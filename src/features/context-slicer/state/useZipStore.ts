// packages/context-slicer-app/src/features/context-slicer/state/useZipStore.ts

/**
 * @file src/features/context-slicer/state/useZipStore.ts
 * @architectural-role State Management / Store Orchestrator / Public API
 *
 * @description
 * This file composes all the individual state slices into the single, canonical
 * Zustand store for the Context Slicer application. It is the public API for the
 * feature.
 *
 * @core-principles
 * 1. **Simplicity through Modularity:** Complexity is managed by composing small,
 *    well-defined slices, adhering to the 250 LOC limit.
 * 2. **Explicit Contract:** The final store shape is explicitly defined by
 *    combining ZipState with the individual slice interfaces.
 */

import { create } from 'zustand';

// Import all necessary components
import type { ZipState } from './zip-state';
import { initialState } from './zip-state';
import { createLoaderSlice, type LoaderSlice } from './zip-loader';
import { createGraphSlice, type GraphSlice } from './zip-graph-manager';
import { createPathSlice, type PathSlice } from './zip-path-manager';

// 1. Define the final, composed state shape (This is correct)
export type StoreState = ZipState & LoaderSlice & GraphSlice & PathSlice;

// 2. Create the store using the slice creator functions
export const useZipStore = create<StoreState>((set, get, api) => ({
  // Spread the initial state from zip-state.ts
  ...initialState,
  
  // FIX: Pass all three arguments (set, get, api) to each slice creator.
  ...createLoaderSlice(set, get, api),
  ...createGraphSlice(set, get, api),
  ...createPathSlice(set, get, api), // Pass all args even if the slice doesn't use them.
}));