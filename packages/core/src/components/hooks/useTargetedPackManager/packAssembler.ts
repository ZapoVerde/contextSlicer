/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/packAssembler.ts
 * @stamp {"ts":"2026-02-16T20:15:00Z"}
 * @architectural-role Business Logic / Orchestrator
 * @description
 * Orchestrates the construction of the multi-layered context pack string. 
 * Combines the spatial file tree, the project boundary library, and the source 
 * logic into a single cohesive document. Uses pre-computed semantic libraries 
 * to distill boundary dependencies into compact, informative signatures.
 * 
 * @core-principles
 * 1. ENFORCES architectural layering: Spatial Map -> Boundary Library -> Source Logic.
 * 2. PERFORMANCE: MUST avoid redundant AST parsing by consuming pre-computed registries.
 * 3. SIGNAL-DRIVEN: Prioritizes type contracts over logic for external dependencies.
 * 
 * @api-declaration
 *   export async function assembleContextPack(
 *     fileIndex: Map<string, FileEntry>,
 *     targets: TargetedPath[],
 *     preFlightResults: Map<string, PreFlightResult>,
 *     typeLibrary: Map<string, Record<string, string>>,
 *     signatureLibrary: Map<string, Record<string, string>>,
 *     options: AssemblerOptions
 *   ): Promise<string>;
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import * as parser from '@babel/parser';
import { generateFileTree } from '../../../logic/fileTreeUtils.js';
import { 
  generateSummary,
  scanBoundaries, 
  generateBoundaryLibrary 
} from '../../../logic/symbolGraph/index.js';
import type { FileEntry } from '../../../state/slicer-state.js';
import type { 
  TargetedPath, 
  PreFlightResult 
} from './types.js';
import type { File } from '@babel/types';

interface AssemblerOptions {
  /** If true, only extract the JSDoc/Preamble for files. */
  docblocksOnly: boolean;
  /** If true, discovers and includes definitions for symbols that cross the pack boundary. */
  includeBoundaryLibrary: boolean;
  /** Mapping of monorepo/tsconfig aliases to physical directory paths. */
  aliasMap?: Record<string, string>;
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/packAssembler.ts#assembleContextPack
 * @description
 * Builds the final context pack string. Orchestrates the Layer 1.5 lookup 
 * using global Type and Signature libraries for maximum efficiency.
 */
export async function assembleContextPack(
  fileIndex: Map<string, FileEntry>,
  targets: TargetedPath[],
  preFlightResults: Map<string, PreFlightResult>,
  typeLibrary: Map<string, Record<string, string>>,
  signatureLibrary: Map<string, Record<string, string>>,
  options: AssemblerOptions
): Promise<string> {
  const pack: string[] = [];
  const selectedFilesForBoundaryScan: Map<string, File> = new Map();

  // --- LAYER 1: SPATIAL MAP ---
  const tree = generateFileTree(targets.map(t => t.path));
  pack.push('--- START OF CONTEXT PACK ---');
  pack.push('\n--- LAYER 1: SPATIAL MAP ---\n');
  pack.push(tree);

  // Marker for Layer 2 insertion point (used for Layer 1.5 injection)
  const sourceLogicMarker = '\n--- LAYER 2: SOURCE LOGIC ---\n';
  pack.push(sourceLogicMarker);

  // --- LAYER 2: SOURCE LOGIC ---
  for (const target of targets) {
    const fileEntry = fileIndex.get(target.path);
    const preFlight = preFlightResults.get(target.path);
    
    if (!fileEntry || !preFlight) continue;

    if (target.resolution === 'full') {
      // PATTERN A: THE SEED (Full Implementation)
      pack.push(`=== ${target.path} ===`);
      pack.push(`[SEED - Full Implementation]`);
      pack.push('');
      pack.push(preFlight.content);
      pack.push(`\n--- END OF FILE ---\n`);
      
      // Collect AST for Layer 1.5 Boundary Discovery
      if (preFlight.ast) {
        selectedFilesForBoundaryScan.set(target.path, preFlight.ast);
      }
    } else {
      // PATTERN B: THE DEPENDENCY (Summary Brief)
      let ast = preFlight.ast;
      
      // Parse on the fly if pre-flight AST is missing (uncommon but possible)
      if (!ast) {
        try {
          ast = parser.parse(preFlight.content, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
            errorRecovery: true
          });
        } catch {
          ast = null;
        }
      }

      if (ast) {
        const summary = generateSummary(target.path, ast, preFlight.content);
        pack.push(summary);
        pack.push('\n');
      } else {
        pack.push(`=== ${target.path} ===`);
        pack.push(`[SUMMARY - Parse Failure]`);
        pack.push(`// Content omitted due to syntax errors.\n`);
      }
    }
  }

  // --- LAYER 1.5: BOUNDARY LIBRARY ---
  if (options.includeBoundaryLibrary && selectedFilesForBoundaryScan.size > 0) {
    const boundarySymbols = scanBoundaries(
      fileIndex,
      selectedFilesForBoundaryScan,
      options.aliasMap || {}
    );

    if (boundarySymbols.length > 0) {
      // NEW: Pass the Type and Signature libraries for distillation
      const boundaryLibrary = await generateBoundaryLibrary(
        boundarySymbols,
        typeLibrary,
        signatureLibrary
      );
      
      if (boundaryLibrary) {
        // Inject Layer 1.5 BEFORE Layer 2
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

  return pack.join('\n');
}