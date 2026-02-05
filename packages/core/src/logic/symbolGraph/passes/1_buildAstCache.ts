/**
 * @file packages/core/src/logic/symbolGraph/passes/1_buildAstCache.ts
 * @stamp {"ts":"2025-12-05T15:10:00Z"}
 * @architectural-role AST Generation Pass
 *
 * @description 
 * Pass 1 of the symbol graph builder. It parses relevant source files into ASTs.
 * This version uses a chunked parallel execution model to resolve the "Network 
 * Waterfall" bottleneck observed in Desktop (API) mode.
 *
 * @core-principles
 * 1. ENFORCES parallel I/O to maximize throughput on network-based file sources.
 * 2. USES chunking to prevent browser/server socket exhaustion.
 * 3. DISCARDS raw text content immediately after parsing to save memory.
 */
import * as parser from '@babel/parser';
import type { Node } from '@babel/types';
import type { FileEntry } from '../types';

type AstCache = Map<string, Node>;

// The number of concurrent file fetches/parses to perform.
// 20 is a safe middle-ground that provides significant speedup without
// overwhelming the local Express server or browser thread.
const CHUNK_SIZE = 20;

/**
 * Pass 1: Parses all relevant source files into ASTs and caches them.
 * Optimized for Desktop mode by fetching files in parallel chunks.
 */
export async function buildAstCache(
  fileIndex: Map<string, FileEntry>
): Promise<AstCache> {
  const astCache: AstCache = new Map();
  const relevantFiles = Array.from(fileIndex.values()).filter(f =>
    /\.(ts|tsx|js|jsx)$/.test(f.path)
  );

  console.log(`[SymbolGraph] Pass 1: Parsing ${relevantFiles.length} files in chunks of ${CHUNK_SIZE}...`);

  /**
   * Internal helper to fetch and parse a single file.
   * Wrapped in a try/catch to ensure one bad file doesn't kill the batch.
   */
  const processFile = async (file: FileEntry) => {
    try {
      const content = await file.getText();
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
        errorRecovery: true,
      });
      astCache.set(file.path, ast);
    } catch (e) {
      console.warn(`[SymbolGraph] Pass 1: Failed to parse ${file.path}:`, e);
    }
  };

  // Process files in chunks to avoid "Chatty I/O" sequential delays 
  // while maintaining control over memory and socket usage.
  for (let i = 0; i < relevantFiles.length; i += CHUNK_SIZE) {
    const chunk = relevantFiles.slice(i, i + CHUNK_SIZE);
    
    // Fire off all requests in the current chunk simultaneously
    await Promise.all(chunk.map(file => processFile(file)));
  }

  return astCache;
}