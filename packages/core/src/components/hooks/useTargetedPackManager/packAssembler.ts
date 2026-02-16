/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/packAssembler.ts
 * @stamp {"ts":"2026-02-16T06:35:00Z"}
 * @architectural-role Business Logic / Orchestrator
 * @description
 * Orchestrates the construction of the multi-layered context pack. It applies a 
 * resolution gradient: "Seed" files receive full implementation markers, 
 * while distant dependencies are distilled into semantic architectural briefs. 
 * Discovered external symbols are resolved via a Project Boundary Library.
 * 
 * @core-principles
 * 1. ENFORCES mutual exclusivity: a file is either a Seed or a Summary, never both.
 * 2. MUST prioritize the "Signal-to-Noise" ratio by using minimal markers.
 * 3. OWNS the final composition and layering of the context document.
 * 
 * @api-declaration
 *   export async function assembleContextPack(
 *     fileIndex: Map<string, FileEntry>,
 *     targets: TargetedPath[],
 *     preFlightResults: Map<string, PreFlightResult>,
 *     options: AssemblerOptions
 *   ): Promise<string>;
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import * as parser from '@babel/parser';
import { generateFileTree } from '../../../logic/fileTreeUtils';
import { 
  generateSummary,
  scanBoundaries, 
  generateBoundaryLibrary 
} from '../../../logic/symbolGraph';
import type { FileEntry } from '../../../state/slicer-state';
import type { 
  TargetedPath, 
  PreFlightResult 
} from './types';
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
 * Builds the final context pack string. It iterates through targets to build 
 * Source Logic and performs a boundary scan on Seed files to generate the 
 * Layer 1.5 Boundary Library. Now utilizes the aliasMap for accurate monorepo resolution.
 */
export async function assembleContextPack(
  fileIndex: Map<string, FileEntry>,
  targets: TargetedPath[],
  preFlightResults: Map<string, PreFlightResult>,
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
      // We only scan boundaries for FULL implementation files to keep the 
      // boundary library focused on the primary context.
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
        // Fallback for files that completely fail parsing
        pack.push(`=== ${target.path} ===`);
        pack.push(`[SUMMARY - Parse Failure]`);
        pack.push(`// Content omitted due to syntax errors.\n`);
      }
    }
  }

  // --- LAYER 1.5: BOUNDARY LIBRARY ---
  // We scan the symbols imported by our Seeds that are NOT in the selection.
  if (options.includeBoundaryLibrary && selectedFilesForBoundaryScan.size > 0) {
    // RESOLUTION FIX: Pass the aliasMap to the scanner to support monorepo imports (@prism/*)
    const boundarySymbols = scanBoundaries(
      fileIndex,
      selectedFilesForBoundaryScan,
      options.aliasMap || {}
    );

    if (boundarySymbols.length > 0) {
      const boundaryLibrary = await generateBoundaryLibrary(
        fileIndex, 
        boundarySymbols
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