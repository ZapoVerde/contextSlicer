/**
 * @file packages/core/src/logic/worker/packAssembler.ts
 * @stamp {"ts":"2026-02-16T20:35:00Z"}
 * @architectural-role Business Logic / Logic Module
 * @description
 * Implements the "Construction Engine" for the context pack generation phase. 
 * Orchestrates the concatenation of spatial metadata, boundary definitions, 
 * and source logic. Handles off-thread Tiktoken BPE counting to ensure 
 * accurate size reporting without blocking the UI.
 *
 * @core-principles
 * 1. IS a pure logic module for multi-file assembly.
 * 2. OWNS the accurate token counting logic (cl100k_base).
 * 3. MUST ensure structural integrity of the final context document.
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

/**
 * @id packages/core/src/logic/worker/packAssembler.ts#assemblePack
 * @description
 * Constructs the final context pack string from provided file content and targets.
 * 
 * @param data - The payload containing targets, file content, and options.
 * @param tokenizer - The initialized Tiktoken instance for token counting.
 */
export async function assemblePack(
  data: AssemblyPayload,
  tokenizer: Tiktoken
): Promise<AssemblyResult> {
  const { targets, files, options } = data;
  const pack: string[] = [];
  
  // 1. AST Cache for Boundary Scanning
  // We parse targeted files to identify external dependencies.
  const targetAsts = new Map<string, File>();
  
  // Lightweight mock of the File Index required by the extraction services.
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

    if (target.resolution === 'full') {
      // Seed Extraction (Full Source)
      pack.push(`=== ${target.path} ===`);
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
      } catch (e) {
        // Continue if parsing fails; boundary scanning will skip this file.
      }

    } else {
      // Dependency Extraction (Semantic Summary)
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
        pack.push(`=== ${target.path} ===`);
        pack.push(`[SUMMARY - Parse Failure]`);
        pack.push(`// Content omitted due to syntax errors.\n`);
      }
    }
  }

  // --- LAYER 1.5: BOUNDARY LIBRARY ---
  if (options.includeBoundaryLibrary && targetAsts.size > 0) {
    // Note: In this worker-bound decomposition, we pass the local file mock.
    // If global libraries are available in the payload, they should be passed here.
    const boundarySymbols = scanBoundaries(
      fileIndexMock as any, 
      targetAsts
    );

    if (boundarySymbols.length > 0) {
      // Refactor Note: In the decomposed state, the worker generates a local 
      // boundary library based on available file content.
      const boundaryLibrary = await generateBoundaryLibrary(
        boundarySymbols,
        new Map(), // Local worker does not have the global typeLibrary
        new Map()  // Local worker does not have the global signatureLibrary
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
  
  // Accurate token count using Tiktoken
  const tokenCount = tokenizer.encode(fullText).length;

  return {
    fullText,
    tokenCount
  };
}