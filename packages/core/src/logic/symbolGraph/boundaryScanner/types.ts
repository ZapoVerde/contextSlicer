/**
 * @file packages/core/src/logic/symbolGraph/boundaryScanner/types.ts
 * @stamp {"ts":"2026-02-15T12:00:00Z"}
 * @architectural-role Type Definition
 * @description
 * Canonical type definitions for the boundary scanning engine. Defines the 
 * structures for identified external symbols and the mapping of pre-parsed 
 * ASTs used to prevent redundant parsing.
 * 
 * @core-principles
 * 1. IS the single source of truth for boundary-crossing data structures.
 * 2. ENFORCES architectural consistency between the tracer and the context pack generator.
 * 3. MUST remain platform-agnostic (pure type definitions).
 * 
 * @api-declaration
 *   export interface BoundarySymbol { identifier: string; sourcePath: string; }
 *   export type SelectedFileMap = Map<string, File>;
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { File } from '@babel/types';

/**
 * @id packages/core/src/logic/symbolGraph/boundaryScanner/types.ts#BoundarySymbol
 * @description
 * Represents a symbol that is imported by a file within the context pack but 
 * is defined in a file outside the pack.
 */
export interface BoundarySymbol {
  /** 
   * The name of the symbol being imported (e.g., 'User', 'ApiClient'). 
   * Use 'default' for default exports and '*' for namespace imports.
   */
  identifier: string;
  /** 
   * The absolute file path (relative to project root) where this symbol is defined.
   * This path must exist in the global project file index.
   */
  sourcePath: string;
}

/**
 * @id packages/core/src/logic/symbolGraph/boundaryScanner/types.ts#SelectedFileMap
 * @description
 * A mapping of project-relative file paths to their corresponding Babel AST File nodes.
 * This is used to pass pre-parsed trees to logic functions to avoid redundant I/O and parsing.
 */
export type SelectedFileMap = Map<string, File>;