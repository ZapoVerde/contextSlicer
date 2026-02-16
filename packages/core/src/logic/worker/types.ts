/**
 * @file packages/core/src/logic/worker/types.ts
 * @stamp {"ts":"2026-02-16T15:30:00Z"}
 * @architectural-role Type Definition
 * @description
 * Defines the messaging protocol for the Worker pool. Expanded to support 
 * off-thread Context Pack Assembly and accurate Tiktoken counting.
 *
 * @core-principles
 * 1. IS the single source of truth for the Worker messaging protocol.
 * 2. MUST use serializable types only (No Maps or Sets).
 * 3. ENFORCES the separation of UI state and heavy text processing.
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
export type TaskType = 'ANALYZE_FILE' | 'INITIALIZE' | 'ASSEMBLE_PACK';

/**
 * @id packages/core/src/logic/worker/types.ts#DistilledMetadata
 * @description Lean architectural metadata extracted from a source file's AST.
 */
export interface DistilledMetadata {
  filePath: string;
  symbols: string[];
  imports: string[];
  hasReexports: boolean;
  hasLogicActivity: boolean;
  isBarrel: boolean;
}

/**
 * @id packages/core/src/logic/worker/types.ts#AssemblyPayload
 * @description Data required by the worker to build a context pack.
 */
export interface AssemblyPayload {
  /** Map of path to resolution type (e.g., 'full' or 'summary') */
  targets: Array<{ path: string; resolution: 'full' | 'summary' }>;
  /** Plain object mapping file paths to their raw text content */
  files: Record<string, string>;
  /** Options for output formatting */
  options: {
    docblocksOnly: boolean;
    includeBoundaryLibrary: boolean;
  };
}

/**
 * @id packages/core/src/logic/worker/types.ts#AssemblyResult
 * @description The completed context pack produced by the worker.
 */
export interface AssemblyResult {
  /** The final concatenated and distilled text string */
  fullText: string;
  /** The 100% accurate Tiktoken BPE token count */
  tokenCount: number;
}

/**
 * @id packages/core/src/logic/worker/types.ts#WorkerTask
 * @description The input payload sent from the Main Thread to a Worker.
 */
export interface WorkerTask {
  taskId: string;
  type: TaskType;
  payload: {
    path?: string;
    content?: string;
    assembly?: AssemblyPayload; // NEW: Specific payload for assembly task
  };
}

/**
 * @id packages/core/src/logic/worker/types.ts#WorkerResult
 * @description The output payload returned from a Worker to the Main Thread.
 */
export interface WorkerResult {
  taskId: string;
  payload?: DistilledMetadata;
  assembly?: AssemblyResult; // NEW: Result of the assembly task
  error?: string;
}