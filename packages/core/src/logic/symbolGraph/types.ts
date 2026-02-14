/**
 * @file packages/core/src/logic/symbolGraph/types.ts
 * @stamp {"ts":"2026-02-14T07:15:00Z"}
 * @architectural-role Type Definition
 * @description
 * Canonical data structures for the symbol dependency graph and the logical 
 * tracing engine. Extends basic graph nodes with metadata required for 
 * scent-sensitive path analysis and passthrough detection.
 * 
 * @core-principles
 * 1. IS the single source of truth for graph-related data schemas.
 * 2. ENFORCES architectural consistency between the tracer and UI state.
 * 3. MUST remain platform-agnostic (browser/node safe).
 * 
 * @api-declaration
 *   export type TraceMode = 'physical' | 'logical';
 *   export type PassiveOutputMode = 'full' | 'docblock' | 'meta';
 *   export interface TraceOptions { ... }
 *   export interface TracedNode { ... }
 *   export interface SymbolNode { ... }
 * 
 * @contract
 *   assertions:
 *     purity: pure # Type definitions only.
 *     external_io: none
 */

import type { FileEntry } from '../../state/slicer-state';

/**
 * @id packages/core/src/logic/symbolGraph/types.ts#TraceMode
 * @description
 * Determines the hop-counting strategy for the tracer.
 * 'physical' counts every file as 1 hop.
 * 'logical' treats barrels and passthroughs as 0-cost "wormholes."
 */
export type TraceMode = 'physical' | 'logical';

/**
 * @id packages/core/src/logic/symbolGraph/types.ts#PassiveOutputMode
 * @description
 * Defines how files classified as "passive" or "pipes" are rendered in the final pack.
 * 'full': Include entire file content.
 * 'docblock': Include only the leading preamble/JSDoc block.
 * 'meta': Include only the file path as a metadata comment.
 */
export type PassiveOutputMode = 'full' | 'docblock' | 'meta';

/**
 * @id packages/core/src/logic/symbolGraph/types.ts#TraceDirection
 * @description
 * Defines the directionality of graph traversal relative to the seed.
 */
export type TraceDirection = 'dependencies' | 'dependents' | 'both';

/**
 * @id packages/core/src/logic/symbolGraph/types.ts#TraceOptions
 * @description
 * Configuration object for the logical tracing engine.
 */
export interface TraceOptions {
  /** The hop-counting strategy (Physical vs Logical) */
  mode: TraceMode;
  /** The direction to traverse in the graph */
  direction: TraceDirection;
  /** Maximum number of logical junctions to traverse */
  maxHops: number;
  /** The starting identifier name to follow (the "Scent") */
  initialScent?: string;
}

/**
 * @id packages/core/src/logic/symbolGraph/types.ts#TracedNode
 * @description
 * A file node resulting from a trace operation, enriched with logical metadata.
 */
export interface TracedNode {
  /** Relative path to the file */
  path: string;
  /** Classification of the file's role in the trace */
  status: 'meaningful' | 'passive';
  /** The specific identifier name being tracked when this file was reached */
  scent: string;
  /** The depth at which this file was discovered */
  depth: number;
}

/**
 * @id packages/core/src/logic/symbolGraph/types.ts#SymbolNode
 * @description
 * Represents a single symbol (function, class, variable) or a file node in the code graph.
 */
export interface SymbolNode {
  /** Unique identifier: 'path/to/file.ts#symbolName' or 'path/to/file.ts' */
  id: string;
  /** Relative file path where the symbol is defined */
  filePath: string;
  /** The name of the symbol, or '(file)' for file-level nodes */
  symbolName: string;
  /** IDs of nodes this node depends on */
  dependencies: Set<string>;
  /** IDs of nodes that depend on this node */
  dependents: Set<string>;
}

/**
 * @id packages/core/src/logic/symbolGraph/types.ts#SymbolGraph
 * @description
 * The main graph structure, mapping a node's unique ID to its SymbolNode object.
 */
export type SymbolGraph = Map<string, SymbolNode>;

export type { FileEntry };