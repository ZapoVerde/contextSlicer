/**
 * @file packages/core/src/state/useSlicerStore.ts
 * @stamp 2025-11-24T06:15:00Z
 * @architectural-role State Management
 * @description
 * The entry point for the global application state. Composes the loader, graph,
 * and path slices into a single Zustand store.
 * @core-principles
 * 1. IS the single source of truth for application state.
 * 2. COMPOSES functionality from modular slices.
 */

import { create } from 'zustand';
import { type SlicerState, initialState } from './slicer-state';
import { createLoaderSlice, type LoaderSlice } from './slicer-loader';
// We assume these files are renamed from their 'zip-' counterparts
import { createGraphSlice, type GraphSlice } from './slicer-graph-manager';
import { createPathSlice, type PathSlice } from './slicer-path-manager';

export type StoreState = SlicerState & LoaderSlice & GraphSlice & PathSlice;

export const useSlicerStore = create<StoreState>((set, get, api) => ({
  ...initialState,
  ...createLoaderSlice(set, get, api),
  ...createGraphSlice(set, get, api),
  ...createPathSlice(set, get, api),
}));