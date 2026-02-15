/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/packAssembler.ts
 * @stamp {"ts":"2026-02-15T11:15:00Z"}
 * @architectural-role Business Logic / Service
 * @description
 * Orchestrates the assembly of the Three-Layer Context Pack. It combines the 
 * spatial map, external boundary types, and implementation logic into a single 
 * high-signal document optimized for LLM context windows.
 * 
 * @core-principles
 * 1. ENFORCES the Three-Layer architectural sequence (Spatial -> Library -> Logic).
 * 2. MUST prioritize token efficiency by using summaries for distant dependencies.
 * 3. IS a pure service that operates on pre-loaded data to ensure deterministic output.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { generateFileTree } from '../../../logic/fileTreeUtils';
import { extractFilePreamble } from '../../../logic/preambleUtils';
import { generateSummary } from '../../../logic/symbolGraph/summaryGenerator';
import { scanBoundaries, type SelectedFileMap } from '../../../logic/symbolGraph/boundaryScanner';
import { generateBoundaryLibrary } from '../../../logic/symbolGraph/typeDefinitionExtractor';
import type { FileEntry } from '../../../state/slicer-state';
import type { TargetedPath, PreFlightResult } from './types';

interface AssemblerOptions {
  docblocksOnly: boolean;
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/packAssembler.ts#assembleContextPack
 * @description
 * Compiles the final context pack string. It resolves boundaries using the 
 * pre-parsed ASTs and applies the requested resolution levels (Full vs Summary) 
 * to the source logic layer.
 */
export async function assembleContextPack(
  targets: TargetedPath[],
  preFlightData: PreFlightResult[],
  fileIndex: Map<string, FileEntry>,
  options: AssemblerOptions
): Promise<string> {
  // 1. Prepare Lookup Maps from Pre-Flight Data
  const contentMap = new Map<string, string>();
  const astMap: SelectedFileMap = new Map();

  preFlightData.forEach(res => {
    contentMap.set(res.path, res.content);
    if (res.ast) {
      astMap.set(res.path, res.ast);
    }
  });

  // --- LAYER 2: BOUNDARY DISCOVERY ---
  // Scan for external symbols that cross the context boundary
  const boundarySymbols = scanBoundaries(fileIndex, astMap);
  const boundaryLibrary = await generateBoundaryLibrary(fileIndex, boundarySymbols);

  // --- LAYER 3: SOURCE LOGIC ASSEMBLY ---
  // Process each target based on its resolution mode
  const logicParts = targets.map((target) => {
    const content = contentMap.get(target.path);
    const ast = astMap.get(target.path);

    if (!content) {
      return `// ----- ${target.path} (ERROR) -----\n// Content not found during assembly phase.`;
    }

    // Resolution: Summary (Architectural Distillation)
    if (target.resolution === 'summary') {
      if (ast) {
        return generateSummary(target.path, ast, content);
      }
      return `// ----- ${target.path} (FALLBACK) -----\n// AST parsing failed; summary unavailable.`;
    }

    // Resolution: Full Text (Implementation)
    let processedContent = content;
    if (options.docblocksOnly) {
      const preamble = extractFilePreamble(content);
      processedContent = preamble || '// (No docblock found at file start)';
    }

    return `// ----- ${target.path} -----\n${processedContent}`;
  });

  // --- LAYER 1: SPATIAL MAP ---
  const tree = generateFileTree(targets.map(t => t.path));

  const timestamp = new Date().toISOString();
  return [
    `--- START OF CONTEXT PACK - ${timestamp} ---`,
    `--- LAYER 1: SPATIAL MAP ---`,
    tree,
    `--- LAYER 2: BOUNDARY LIBRARY ---`,
    boundaryLibrary || '// No external symbols crossing the boundary detected.',
    `--- LAYER 3: SOURCE LOGIC ---`,
    ...logicParts,
    '--- END OF PACK ---'
  ].join('\n\n');
}