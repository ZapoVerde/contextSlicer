/**
 * @file packages/core/src/logic/worker/packAssembler.ts
 * @stamp {"ts":"2026-02-16T21:55:00Z"}
 * @architectural-role Business Logic / Logic Module
 * @description
 * Implements the "Construction Engine" for the context pack generation phase. 
 * Orchestrates the concatenation of spatial metadata, boundary definitions, 
 * and source logic. Now supports "Docblocks Only" mode by stitching JSDoc 
 * preambles with pre-computed structural contract briefs (Imports/Exports).
 *
 * @core-principles
 * 1. IS a pure logic module for multi-file assembly.
 * 2. OWNS the accurate token counting logic (cl100k_base).
 * 3. SIGNAL-PRIORITY: Ensures architectural context is preserved even when code is omitted.
 *
 * @api-declaration
 *   export async function assemblePack(
 *     data: AssemblyPayload, 
 *     tokenizer: Tiktoken
 *   ): Promise<AssemblyResult>;
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import * as parser from '@babel/parser';
import type { File } from '@babel/types';
import type { Tiktoken } from 'js-tiktoken';
import type { AssemblyPayload, AssemblyResult } from './types.js';

// Logic Imports
import { generateFileTree } from '../fileTreeUtils.js';
import { generateSummary } from '../symbolGraph/summaryGenerator.js';
import { scanBoundaries } from '../symbolGraph/boundaryScanner/index.js';
import { generateBoundaryLibrary } from '../symbolGraph/typeDefinitionExtractor.js';
import { extractFilePreamble } from '../preambleUtils.js';

/**
 * @id packages/core/src/logic/worker/packAssembler.ts#assemblePack
 * @description
 * Constructs the final context pack string. Corrects the "Paradox" by providing 
 * structural contracts for boundary files and optionally for all files 
 * when in Docblock-only mode.
 * 
 * @param data - The payload containing targets, file content, and pre-computed contracts.
 * @param tokenizer - The initialized Tiktoken instance for token counting.
 */
export async function assemblePack(
  data: AssemblyPayload,
  tokenizer: Tiktoken
): Promise<AssemblyResult> {
  const { targets, files, contractLibrary, options } = data;
  const pack: string[] = [];
  
  const targetAsts = new Map<string, File>();
  const fileIndexMock = new Map<string, any>();
  
  Object.keys(files).forEach(path => {
    fileIndexMock.set(path, {
      path,
      getText: async () => files[path]
    });
  });

  // --- LAYER 1: SPATIAL MAP ---
  const tree = generateFileTree(targets.map(t => t.path));
  pack.push('--- START OF CONTEXT PACK ---');
  pack.push('\n--- LAYER 1: SPATIAL MAP ---\n');
  pack.push(tree);

  const sourceLogicMarker = '\n--- LAYER 2: SOURCE LOGIC ---\n';
  pack.push(sourceLogicMarker);

  // --- LAYER 2: SOURCE LOGIC ---
  for (const target of targets) {
    const content = files[target.path];
    if (content === undefined) continue;

    pack.push(`=== ${target.path} ===`);

    // STRATEGY: Docblocks Only (Global Override)
    if (options.docblocksOnly) {
      pack.push('[PREAMBLE & CONTRACT]');
      const preamble = extractFilePreamble(content);
      if (preamble) pack.push(preamble);
      
      const brief = contractLibrary[target.path];
      if (brief) pack.push(brief);
      
      pack.push(`\n--- END OF FILE ---\n`);
      continue;
    }

    // STRATEGY: Standard Resolution Gradient
    if (target.resolution === 'full') {
      pack.push(`[SEED - Full Implementation]`);
      pack.push('');
      pack.push(content);
      pack.push(`\n--- END OF FILE ---\n`);

      try {
        const ast = parser.parse(content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
          errorRecovery: true
        });
        targetAsts.set(target.path, ast);
      } catch { /* skip boundary scan for this file */ }

    } else {
      // Summary Brief
      try {
        const ast = parser.parse(content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
          errorRecovery: true
        });
        const summary = generateSummary(target.path, ast, content);
        pack.push(summary);
        pack.push('\n');
      } catch {
        pack.push(`[SUMMARY - Parse Failure]`);
        pack.push(`// Content omitted due to syntax errors.\n`);
      }
    }
  }

  // --- LAYER 1.5: BOUNDARY LIBRARY ---
  if (options.includeBoundaryLibrary && targetAsts.size > 0) {
    const boundarySymbols = scanBoundaries(fileIndexMock as any, targetAsts);

    if (boundarySymbols.length > 0) {
      // Use the provided contractLibrary for semantic boundary extraction
      const boundaryLibrary = await generateBoundaryLibrary(
        boundarySymbols,
        new Map(), // Type signatures handled via synthetic signatures if available
        new Map()  // Signature Library should ideally be passed in payload too
      );
      
      if (boundaryLibrary) {
        const markerIndex = pack.indexOf(sourceLogicMarker);
        if (markerIndex !== -1) {
          pack.splice(markerIndex, 0, 
            '\n--- LAYER 1.5: BOUNDARY LIBRARY ---\n',
            boundaryLibrary,
            '\n'
          );
        }
      }
    }
  }

  pack.push('--- END OF PACK ---');
  
  const fullText = pack.join('\n');
  const tokenCount = tokenizer.encode(fullText).length;

  return {
    fullText,
    tokenCount
  };
}