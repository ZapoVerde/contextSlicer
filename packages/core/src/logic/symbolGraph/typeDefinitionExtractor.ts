/**
 * @file packages/core/src/logic/symbolGraph/typeDefinitionExtractor.ts
 * @stamp {"ts":"2026-02-16T23:25:00Z"}
 * @architectural-role Business Logic / Extraction Engine
 * @description
 * Extracts semantically distilled signatures and type contracts for boundary symbols.
 * Leverages the pre-computed Type and Signature libraries to avoid redundant 
 * AST parsing during the assembly phase. Implements the "Local Chaser" logic
 * to ensure that component signatures are accompanied by their property interfaces.
 * 
 * @core-principles
 * 1. IS responsible for retrieving the semantic contract of external dependencies.
 * 2. PERFORMANCE: MUST achieve sub-millisecond execution via pre-computed lookups.
 * 3. CONTRACT-FIRST: Prioritizes type definitions and synthetic signatures over logic.
 * 
 * @api-declaration
 *   export async function generateBoundaryLibrary(
 *     boundarySymbols: BoundarySymbol[],
 *     typeLibrary: Map<string, Record<string, string>>,
 *     signatureLibrary: Map<string, Record<string, string>>
 *   ): Promise<string>;
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { BoundarySymbol } from './boundaryScanner/index.js';

/**
 * @id packages/core/src/logic/symbolGraph/typeDefinitionExtractor.ts#generateBoundaryLibrary
 * @description
 * Orchestrates the extraction of semantically distilled content for all boundary symbols.
 * Groups by file and pulls pre-computed definitions from the global registries.
 * 
 * @param boundarySymbols - The list of identified leaks crossing the context boundary.
 * @param typeLibrary - Global registry of Type/Interface/Enum source code.
 * @param signatureLibrary - Global registry of synthetic Value signatures.
 */
export async function generateBoundaryLibrary(
  boundarySymbols: BoundarySymbol[],
  typeLibrary: Map<string, Record<string, string>>,
  signatureLibrary: Map<string, Record<string, string>>
): Promise<string> {
  if (boundarySymbols.length === 0) return '';

  // 1. Group symbols by source file
  const symbolsByFile = new Map<string, Set<string>>();
  for (const sym of boundarySymbols) {
    if (!symbolsByFile.has(sym.sourcePath)) {
      symbolsByFile.set(sym.sourcePath, new Set());
    }
    symbolsByFile.get(sym.sourcePath)!.add(sym.identifier);
  }

  const libraryChunks: string[] = [];

  // 2. Process each file using O(1) dictionary lookups
  for (const [filePath, requestedIdentifiers] of symbolsByFile.entries()) {
    const fileTypes = typeLibrary.get(filePath) || {};
    const fileSignatures = signatureLibrary.get(filePath) || {};
    
    const extractedLines: string[] = [];
    const addedIdentifiers = new Set<string>();

    /**
     * The "Local Chaser": Recursively finds types within a text string 
     * that exist in this file's type library.
     */
    const chaseLocalTypes = (text: string) => {
      // Find all potential identifiers (words) in the text
      const words = text.match(/\b(\w+)\b/g);
      if (!words) return;

      for (const word of words) {
        // If the word matches a locally defined type we haven't included yet
        if (fileTypes[word] && !addedIdentifiers.has(word)) {
          addedIdentifiers.add(word);
          extractedLines.push(fileTypes[word]);
          // Recurse to find types used within this type (Deep Local Chasing)
          chaseLocalTypes(fileTypes[word]);
        }
      }
    };

    for (const id of requestedIdentifiers) {
      if (addedIdentifiers.has(id)) continue;

      // Priority 1: Synthetic Value Signatures (Components/Functions)
      if (fileSignatures[id]) {
        addedIdentifiers.add(id);
        extractedLines.push(fileSignatures[id]);
        // Trigger the Chaser to find local props/types mentioned in the signature
        chaseLocalTypes(fileSignatures[id]);
      } 
      // Priority 2: Direct Type Definitions (Interfaces/Aliases)
      else if (fileTypes[id]) {
        addedIdentifiers.add(id);
        extractedLines.push(fileTypes[id]);
        // Recurse for nested type dependencies
        chaseLocalTypes(fileTypes[id]);
      }
    }

    if (extractedLines.length > 0) {
      libraryChunks.push(
        `--- ${filePath} ---\n${extractedLines.join('\n\n')}`
      );
    }
  }

  if (libraryChunks.length === 0) return '';

  return [
    '=== PROJECT BOUNDARY DEFINITIONS ===',
    'The following symbols are imported by your selected files but reside outside the context pack.',
    'Implementations are distilled into synthetic signatures to preserve architectural context.',
    '',
    ...libraryChunks,
    '',
    '===================================='
  ].join('\n');
}