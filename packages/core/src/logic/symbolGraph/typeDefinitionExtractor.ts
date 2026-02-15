/**
 * @file packages/core/src/logic/symbolGraph/typeDefinitionExtractor.ts
 * @stamp {"ts":"2026-02-15T09:45:00Z"}
 * @architectural-role Business Logic / Extraction Engine
 * @description
 * Extracts raw source code for specific type definitions from files outside the 
 * context pack. It supports "Shallow Peeking" to retrieve the shape of symbols 
 * that cross the context boundary.
 * 
 * @core-principles
 * 1. IS responsible for retrieving the "Contract" of external dependencies.
 * 2. MUST prioritize token efficiency (extract only what is asked).
 * 3. DOES NOT perform deep recursive resolution (limits to 1 level or local refs).
 * 
 * @api-declaration
 *   export async function generateBoundaryLibrary(
 *     fileIndex: Map<string, FileEntry>,
 *     boundarySymbols: BoundarySymbol[]
 *   ): Promise<string>;
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import type { FileEntry } from '../../state/slicer-state';
import type { BoundarySymbol } from './boundaryScanner';

/**
 * @id packages/core/src/logic/symbolGraph/typeDefinitionExtractor.ts#generateBoundaryLibrary
 * @description
 * Orchestrates the extraction of type definitions for all boundary symbols.
 * Groups by file and formats the output into a "Boundary Library" block.
 */
export async function generateBoundaryLibrary(
  fileIndex: Map<string, FileEntry>,
  boundarySymbols: BoundarySymbol[]
): Promise<string> {
  if (boundarySymbols.length === 0) return '';

  // 1. Group symbols by source file to minimize parsing
  const symbolsByFile = new Map<string, Set<string>>();
  for (const sym of boundarySymbols) {
    if (!symbolsByFile.has(sym.sourcePath)) {
      symbolsByFile.set(sym.sourcePath, new Set());
    }
    symbolsByFile.get(sym.sourcePath)!.add(sym.identifier);
  }

  const libraryChunks: string[] = [];

  // 2. Process each file
  for (const [filePath, identifiers] of symbolsByFile.entries()) {
    const fileEntry = fileIndex.get(filePath);
    if (!fileEntry) continue;

    try {
      const content = await fileEntry.getText();
      const extractedCode = extractDefinitions(content, identifiers);
      
      if (extractedCode.length > 0) {
        libraryChunks.push(
          `--- ${filePath} ---\n${extractedCode.join('\n\n')}`
        );
      }
    } catch (e) {
      console.warn(`[TypeExtractor] Failed to process ${filePath}`, e);
    }
  }

  if (libraryChunks.length === 0) return '';

  return [
    '=== PROJECT BOUNDARY DEFINITIONS ===',
    'The following symbols are imported by your selected files but reside outside the current context pack.',
    '',
    ...libraryChunks,
    '',
    '===================================='
  ].join('\n');
}

/**
 * Parses source code and extracts the AST nodes for specific named exports.
 * Handles Interfaces, TypeAliases, Classes, Enums, and Functions.
 */
function extractDefinitions(source: string, identifiers: Set<string>): string[] {
  const definitions: string[] = [];
  const found = new Set<string>();

  const ast = parser.parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
  });

  traverse(ast, {
    // Handle: export interface User { ... }
    // Handle: export type User = { ... }
    // Handle: export class User { ... }
    // Handle: export enum User { ... }
    ExportNamedDeclaration(path) {
      const decl = path.node.declaration;
      
      if (!decl) return;

      let name = '';
      
      // 1. Check Identifiers based on node type
      if (
        decl.type === 'TSInterfaceDeclaration' || 
        decl.type === 'TSTypeAliasDeclaration' ||
        decl.type === 'ClassDeclaration' ||
        decl.type === 'TSEnumDeclaration' || 
        decl.type === 'FunctionDeclaration'
      ) {
        if (decl.id?.type === 'Identifier') {
          name = decl.id.name;
        }
      } 
      // 2. Handle Variable Declarations (export const User = ...)
      else if (decl.type === 'VariableDeclaration') {
        const declarator = decl.declarations[0];
        if (declarator.id.type === 'Identifier') {
          name = declarator.id.name;
        }
      }

      // 3. Extract if matches requested symbol
      if (name && identifiers.has(name) && !found.has(name)) {
        if (decl.start !== null && decl.end !== null) {
          // We extract the whole ExportNamedDeclaration to keep the 'export' keyword
          // or just the declaration? The prompt example showed 'export interface...', 
          // so using path.node (the export wrapper) is safer for context.
          if (path.node.start !== null && path.node.end !== null) {
            definitions.push(source.slice(path.node.start, path.node.end));
            found.add(name);
          }
        }
      }
    },

    // Handle: export default class ... 
    ExportDefaultDeclaration(path) {
      if (identifiers.has('default') && !found.has('default')) {
        if (path.node.start !== null && path.node.end !== null) {
           definitions.push(source.slice(path.node.start, path.node.end));
           found.add('default');
        }
      }
    }
  });

  return definitions;
}