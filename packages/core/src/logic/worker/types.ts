/**
 * @file packages/core/src/logic/worker/types.ts
 * @stamp {"ts":"2026-02-16T22:40:00Z"}
 * @architectural-role Type Definition
 * @description
 * Defines the canonical messaging protocol and data structures for background 
 * workers. Facilitates the transfer of distilled architectural metadata, 
 * including pre-computed type closures, synthetic signatures, and structural 
 * contract briefs for dependency mapping and context pack assembly.
 *
 * @core-principles
 * 1. IS the single source of truth for the Worker messaging protocol.
 * 2. MUST use serializable types (plain objects/records) to ensure cross-thread 
 *    compatibility via the Structured Clone algorithm.
 * 3. ENFORCES the separation of heavy AST-based processing from UI-bound state.
 *
 * @api-declaration
 *   export type TaskType = 'ANALYZE_FILE' | 'INITIALIZE' | 'ASSEMBLE_PACK';
 *   export interface DistilledMetadata { ... }
 *   export interface AssemblyPayload { ... }
 *   export interface AssemblyResult { ... }
 *   export interface WorkerTask { ... }
 *   export interface WorkerResult { ... }
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

/**
 * The categorization of work dispatched to the worker pool.
 */
export type TaskType = 'ANALYZE_FILE' | 'INITIALIZE' | 'ASSEMBLE_PACK';

/**
 * Lean architectural metadata and semantically distilled signatures 
 * extracted from a source file's AST.
 */
export interface DistilledMetadata {
  /** Project-relative path of the analyzed file. */
  filePath: string;
  /** List of all top-level symbols exported or defined. */
  symbols: string[];
  /** List of raw import/export source strings (dependency edges). */
  imports: string[];
  /** Flag for Part 1 of the Pipe Detection Rule. */
  hasReexports: boolean;
  /** Flag for Part 2 of the Pipe Detection Rule. */
  hasLogicActivity: boolean;
  /** Flag identifying the file as a pure organizational barrel. */
  isBarrel: boolean;
  /** 
   * A registry of locally defined type contracts (Interfaces, Aliases, Enums).
   * Key: Symbol Name. Value: Raw Source Code of the declaration.
   */
  typeRegistry: Record<string, string>;
  /**
   * Virtualized signatures for implementations (Components, Functions).
   * Key: Symbol Name. Value: A synthetic 'export declare' string.
   */
  syntheticSignatures: Record<string, string>;
  /**
   * A human-readable summary of the file's imports and exports.
   * Used for "Docblocks Only" mode to provide a dependency map.
   */
  contractBrief: string;
}

/**
 * Data required by the worker to build a multi-layered context pack.
 * Updated to include serialized semantic registries for Layer 1.5 generation.
 */
export interface AssemblyPayload {
  /** Map of path to resolution type (e.g., 'full' or 'summary') */
  targets: Array<{ path: string; resolution: 'full' | 'summary' }>;
  /** Plain object mapping file paths to their raw text content */
  files: Record<string, string>;
  /** 
   * Pre-computed contract briefs for high-speed assembly in Docblock mode.
   * Key: FilePath. Value: ContractBrief string.
   */
  contractLibrary: Record<string, string>;
  /**
   * Serialized registry of type definitions.
   * Key: FilePath. Value: Record of { SymbolName -> Source }.
   */
  typeLibrary: Record<string, Record<string, string>>;
  /**
   * Serialized registry of synthetic signatures.
   * Key: FilePath. Value: Record of { SymbolName -> Source }.
   */
  signatureLibrary: Record<string, Record<string, string>>;
  /** Options for output formatting */
  options: {
    docblocksOnly: boolean;
    includeBoundaryLibrary: boolean;
  };
}

/**
 * The completed context pack produced by the background worker.
 */
export interface AssemblyResult {
  /** The final concatenated and distilled text string */
  fullText: string;
  /** The 100% accurate Tiktoken BPE token count */
  tokenCount: number;
}

/**
 * The input payload sent from the Main Thread to a Worker.
 */
export interface WorkerTask {
  /** Unique correlation identifier for the task. */
  taskId: string;
  /** The operation type. */
  type: TaskType;
  /** Task-specific payload. */
  payload: {
    path?: string;
    content?: string;
    assembly?: AssemblyPayload;
  };
}

/**
 * The output payload returned from a Worker to the Main Thread.
 */
export interface WorkerResult {
  /** Correlation identifier matching the original task. */
  taskId: string;
  /** Metadata returned from file analysis. */
  payload?: DistilledMetadata;
  /** Result of a pack assembly operation. */
  assembly?: AssemblyResult;
  /** Error message if the operation failed. */
  error?: string;
}