/**
 * @file packages/core/src/components/hooks/useQueryPanelState/astUtils.ts
 * @stamp {"ts":"2026-02-14T12:35:00Z"}
 * @architectural-role Logic Utility
 * @description
 * Provides helper functions for on-demand AST parsing to support scent-sensitive 
 * logical tracing. This utility is designed to be high-performance, parsing 
 * only the files necessary for a specific trace operation.
 *
 * @core-principles
 * 1. IS a stateless logic utility for AST processing.
 * 2. MUST remain decoupled from React and the UI state.
 * 3. OWNS the implementation details of Babel parsing for the logical tracer.
 *
 * @api-declaration
 *   export async function buildTemporaryAstCache(
 *     fileIndex: Map<string, FileEntry> | null, 
 *     files: string[]
 *   ): Promise<Map<string, any>>;
 *
 * @contract
 *   assertions:
 *     purity: pure # Async but side-effect free relative to application state.
 *     external_io: none # Reads from memory-backed fileIndex.
 */

import * as parser from '@babel/parser';
import type { FileEntry } from '../../../state/slicer-state';

/**
 * @id packages/core/src/components/hooks/useQueryPanelState/astUtils.ts#buildTemporaryAstCache
 * @description
 * Scans a list of file paths and generates a temporary map of Babel ASTs.
 * Used by the logical tracer to identify barrels and follow identifier scents.
 *
 * @param fileIndex - The current file system snapshot.
 * @param files - The specific paths to parse.
 * @returns A Map where keys are file paths and values are Babel AST nodes.
 */
export async function buildTemporaryAstCache(
  fileIndex: Map<string, FileEntry> | null,
  files: string[]
): Promise<Map<string, any>> {
  const cache = new Map<string, any>();
  if (!fileIndex) {
    return cache;
  }

  const parsePromises = files.map(async (path) => {
    const entry = fileIndex.get(path);
    
    // Only attempt to parse supported source file extensions
    if (entry && /\.(ts|tsx|js|jsx)$/.test(path)) {
      try {
        const content = await entry.getText();
        const ast = parser.parse(content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
          errorRecovery: true,
        });
        cache.set(path, ast);
      } catch (e) {
        // We log warnings but do not fail the entire batch; the tracer 
        // will treat unparseable files as physical junctions.
        console.warn(`[AST-Cache] Failed to parse ${path} for logical trace`, e);
      }
    }
  });

  await Promise.all(parsePromises);
  return cache;
}