/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/preFlightService.ts
 * @stamp {"ts":"2026-02-15T11:10:00Z"}
 * @architectural-role Business Logic / Service
 * @description
 * Provides the "Pre-Flight" engine that loads and parses a set of target files 
 * in parallel. It handles extension-based filtering to ensure only script files 
 * are passed to the Babel parser, preventing unnecessary overhead or crashes 
 * on assets/binary files.
 * 
 * @core-principles
 * 1. OWNS the parallelization strategy for context gathering.
 * 2. MUST ensure every file is fetched and parsed exactly once.
 * 3. IS a pure service that does not depend on React or global state.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import * as parser from '@babel/parser';
import type { FileEntry } from '../../../state/slicer-state';
import type { TargetedPath, PreFlightResult } from './types';

const SCRIPT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/preFlightService.ts#runPreFlight
 * @description
 * Executes a parallel load-and-parse sequence for all provided targets. 
 * Script files are parsed into Babel ASTs for downstream boundary scanning 
 * and architectural distillation.
 * 
 * @param targets - The structured list of paths and their resolution modes.
 * @param fileIndex - The project's file registry.
 */
export async function runPreFlight(
  targets: TargetedPath[],
  fileIndex: Map<string, FileEntry>
): Promise<PreFlightResult[]> {
  const tasks = targets.map(async (target): Promise<PreFlightResult | null> => {
    const entry = fileIndex.get(target.path);
    if (!entry) return null;

    try {
      const content = await entry.getText();
      let ast: parser.ParseResult<import('@babel/types').File> | null = null;

      const isScript = Array.from(SCRIPT_EXTENSIONS).some(ext => 
        target.path.toLowerCase().endsWith(ext)
      );

      if (isScript) {
        try {
          ast = parser.parse(content, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
            errorRecovery: true,
          });
        } catch (e) {
          console.warn(`[PreFlight] Parse failed for: ${target.path}`, e);
        }
      }

      return {
        path: target.path,
        content,
        ast: ast as any // Casting to File | null for internal type compatibility
      };
    } catch (e) {
      console.error(`[PreFlight] I/O failure for: ${target.path}`, e);
      return null;
    }
  });

  const results = await Promise.all(tasks);
  return results.filter((r): r is PreFlightResult => r !== null);
}