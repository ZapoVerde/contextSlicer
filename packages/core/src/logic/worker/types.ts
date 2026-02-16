/**
 * @file packages/core/src/logic/worker/types.ts
 * @stamp {"ts":"2026-02-16T11:40:00Z"}
 * @architectural-role Type Definition
 * @description
 * Defines the messaging protocol and data structures for the persistent Web Worker
 * pool. Ensures type safety across the thread boundary for the "Dumb Server / 
 * Smart Browser" logic engine. Updated to support edge (import) extraction.
 *
 * @core-principles
 * 1. IS the single source of truth for the Worker messaging protocol.
 * 2. MUST use transferable or structured-cloneable types only (No ASTs).
 * 3. ENFORCES the "Distilled Returns" strategy for analysis results.
 *
 * @api-declaration
 *   export type TaskType = 'ANALYZE_FILE' | 'INITIALIZE';
 *   export interface DistilledMetadata { ... }
 *   export interface WorkerTask { ... }
 *   export interface WorkerResult { ... }
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

/**
 * @id packages/core/src/logic/worker/types.ts#TaskType
 * @description The categorization of work dispatched to the worker pool.
 */
export type TaskType = 'ANALYZE_FILE' | 'INITIALIZE';

/**
 * @id packages/core/src/logic/worker/types.ts#DistilledMetadata
 * @description 
 * Lean architectural metadata extracted from a source file's AST. 
 * This structure replaces the heavy Babel AST in cross-thread communication.
 */
export interface DistilledMetadata {
  /** The relative path of the file analyzed */
  filePath: string;
  /** List of top-level exported symbol names */
  symbols: string[];
  /** 
   * List of raw import/re-export source strings (e.g. './utils', '@mui/material').
   * Used by the Main Thread to draw dependency edges.
   */
  imports: string[];
  /** Part 1 of Pipe Rule: Does the file move symbols from elsewhere? */
  hasReexports: boolean;
  /** Part 2 of Pipe Rule: Does the file contain UI logic, hooks, or state? */
  hasLogicActivity: boolean;
  /** Structural check: Is this a pure organizational barrel? */
  isBarrel: boolean;
}

/**
 * @id packages/core/src/logic/worker/types.ts#WorkerTask
 * @description The input payload sent from the Main Thread to a Worker.
 */
export interface WorkerTask {
  /** Unique correlation ID for the task */
  taskId: string;
  /** The type of operation requested */
  type: TaskType;
  /** The payload for the specific task type */
  payload: {
    path: string;
    content: string;
    options?: Record<string, unknown>;
  };
}

/**
 * @id packages/core/src/logic/worker/types.ts#WorkerResult
 * @description The output payload returned from a Worker to the Main Thread.
 */
export interface WorkerResult {
  /** Matches the original WorkerTask taskId */
  taskId: string;
  /** The resulting metadata if successful */
  payload?: DistilledMetadata;
  /** Error message if the operation failed */
  error?: string;
}