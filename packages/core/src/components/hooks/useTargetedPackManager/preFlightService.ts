/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/preFlightService.ts
 * @stamp {"ts":"2026-02-15T10:45:00Z"}
 * @architectural-role Business Logic / Service
 * @description
 * Provides the "Pre-Flight" engine that loads and parses target files in parallel. 
 * Script files are parsed into Babel ASTs to support boundary scanning and 
 * architectural distillation. Returns results in a Map for high-performance 
 * correlation during the assembly phase.
 * 
 * @core-principles
 * 1. OWNS the parallelization strategy for context gathering.
 * 2. MUST ensure every file is fetched and parsed exactly once.
 * 3. IS a pure service that returning indexed results for assembly efficiency.
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
 * Executes a parallel load-and-parse sequence. Script files are parsed with 
 * error recovery enabled to ensure a partial AST is available even for 
 * invalid/draft code.
 * 
 * @param targets - The structured list of paths and their resolution modes.
 * @param fileIndex - The project's file registry.
 * @returns A Map indexing file paths to their content and ASTs.
 */
export async function runPreFlight(
  targets: TargetedPath[],
  fileIndex: Map<string, FileEntry>
): Promise<Map<string, PreFlightResult>> {
  const tasks = targets.map(async (target): Promise<PreFlightResult | null> => {
    const entry = fileIndex.get(target.path);
    if (!entry) return null;

    try {
      const content = await entry.getText();
      let ast: any = null;

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
        ast: ast // Babel types handle this internally
      };
    } catch (e) {
      console.error(`[PreFlight] I/O failure for: ${target.path}`, e);
      return null;
    }
  });

  const resultsArray = await Promise.all(tasks);
  const resultsMap = new Map<string, PreFlightResult>();

  for (const res of resultsArray) {
    if (res) {
      resultsMap.set(res.path, res);
    }
  }

  return resultsMap;
}