/**
 * @file src/features/context-slicer/logic/symbolGraph/types.ts
 * @stamp {"ts":"2025-09-28T18:24:00Z"}
 * @architectural-role Data Model Definition
 *
 * @description
 * This file defines the core TypeScript types and interfaces that describe the
 * structure of the symbol dependency graph. It serves as the single source of
 * truth for the data model, ensuring type safety and a consistent structure
-
 * across all modules involved in building, traversing, or consuming the graph.
 *
 * @contract
 * State Ownership: This module is stateless; it contains only type definitions.
 * Public API: Exports the `SymbolNode`, `SymbolGraph`, and `FileEntry` types.
 * Core Invariants: All other symbol graph modules MUST adhere to the types
 * defined here to ensure a consistent and predictable data structure throughout
 * the feature's logic.
 *
 * @core-principles
 * 1. **Single Source of Truth:** This file is the canonical definition for the
 *    symbol graph data model.
 * 2. **Type Safety:** Its primary purpose is to enforce strict typing for all
 *    graph-related operations.
 * 3. **Decoupling:** By containing no logic or implementation, it decouples the
 *    data shape from the code that manipulates it.
 */
import type { FileEntry } from '../../state/zip-state';

/**
 * Represents a single symbol (function, class, variable) or a file node in the code graph.
 */
export interface SymbolNode {
  id: string; // Unique identifier: 'path/to/file.ts#symbolName' or 'path/to/file.ts'
  filePath: string;
  symbolName: string; // The name of the symbol, or '(file)' for file-level nodes
  dependencies: Set<string>; // IDs of nodes this node depends on
  dependents: Set<string>; // IDs of nodes that depend on this node
}

/**
 * The main graph structure, mapping a node's unique ID to its SymbolNode object.
 */
export type SymbolGraph = Map<string, SymbolNode>;

// Re-exporting FileEntry to make it available to other graph modules.
export type { FileEntry };