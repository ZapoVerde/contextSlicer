/**
 * @file packages/core/src/logic/symbolGraph/passes/1_buildAstCache.ts
 * @stamp {"ts":"2026-02-16T12:30:00Z"}
 * @architectural-role Business Logic / Utility
 * @description
 * Provides pure functions for transforming source code into Babel Abstract 
 * Syntax Trees (AST). Defines the canonical parser configuration used across 
 * both main-thread and worker-thread execution contexts.
 *
 * @core-principles
 * 1. PURITY: Must not access DOM, Window, or application state.
 * 2. ISOLATION: Must be importable by Web Workers without side effects.
 * 3. CONSISTENCY: ENFORCES a single source of truth for Babel parser options.
 *
 * @api-declaration
 *   export const BABEL_CONFIG: parser.ParserOptions;
 *   export function parseSourceToAst(content: string): File;
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import * as parser from '@babel/parser';
import type { File } from '@babel/types';

/**
 * @id packages/core/src/logic/symbolGraph/passes/1_buildAstCache.ts#BABEL_CONFIG
 * @description
 * The authoritative configuration for the Babel parser. Enables TypeScript 
 * and JSX support with error recovery to handle draft code.
 */
export const BABEL_CONFIG: parser.ParserOptions = {
  sourceType: 'module',
  plugins: ['typescript', 'jsx'],
  errorRecovery: true,
  attachComment: true,
} as const;

/**
 * @id packages/core/src/logic/symbolGraph/passes/1_buildAstCache.ts#parseSourceToAst
 * @description
 * Transforms a raw string of source code into a Babel AST File node.
 * 
 * @param content - The raw source text of the file.
 * @returns The parsed AST File node.
 * @throws {SyntaxError} If the code is completely unparseable (unlikely with errorRecovery).
 */
export function parseSourceToAst(content: string): File {
  return parser.parse(content, BABEL_CONFIG);
}

/**
 * @deprecated 
 * The orchestration of the full AST cache has moved to the WorkerPool 
 * via the SymbolGraph index orchestrator. Use parseSourceToAst for 
 * individual file parsing.
 */
export async function buildAstCache(): Promise<never> {
  throw new Error('Orchestration has moved to WorkerPool. Use parseSourceToAst for individual files.');
}