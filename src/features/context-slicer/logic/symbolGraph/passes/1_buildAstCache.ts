/**
 * @file src/features/sourceDump/logic/symbolGraph/passes/1_buildAstCache.ts
 * @architectural-role AST Generation Pass
 *
 * @description This module is responsible for the first pass of the symbol graph
 * generation process. Its sole purpose is to read all relevant source files, parse
 * them into Abstract Syntax Trees (ASTs), and return a cache of these ASTs.
 *
 * @responsibilities
 * 1.  **File Filtering:** It filters the global `fileIndex` to get a list of only
 *     the files that can be parsed (JavaScript and TypeScript).
 * 2.  **AST Parsing:** It iterates through the relevant files, reads their text
 *     content, and uses the `@babel/parser` to generate an AST for each one.
 * 3.  **Caching:** It stores the generated AST for each file in a `Map`, keyed by
 *     the file's path. This cache is crucial for the performance of the subsequent
 *     passes, which need to traverse the ASTs multiple times.
 * 4.  **Error Handling:** It wraps the parsing logic in a `try...catch` block to
 *     gracefully handle and log errors for individual files that may have syntax
 *     errors, preventing a single bad file from crashing the entire process.
 */
import * as parser from '@babel/parser';
import type { Node } from '@babel/types';
import type { FileEntry } from '../types';

type AstCache = Map<string, Node>;

/**
 * Pass 1: Parses all relevant source files into ASTs and caches them.
 * @param fileIndex - The global map of all file entries from the zip.
 * @returns A promise that resolves to the `AstCache` map.
 */
export async function buildAstCache(
  fileIndex: Map<string, FileEntry>
): Promise<AstCache> {
  const astCache: AstCache = new Map();
  const relevantFiles = Array.from(fileIndex.values()).filter(f =>
    /\.(ts|tsx|js|jsx)$/.test(f.path)
  );

  for (const file of relevantFiles) {
    try {
      const content = await file.getText();
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
        errorRecovery: true, // Attempt to parse even with minor errors
      });
      astCache.set(file.path, ast);
    } catch (e) {
      console.warn(`[SymbolGraph] Pass 1: Failed to parse ${file.path}:`, e);
    }
  }

  return astCache;
}