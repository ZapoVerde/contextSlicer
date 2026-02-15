/**
 * @file packages/core/src/logic/symbolGraph/boundaryScanner/index.ts
 * @stamp {"ts":"2026-02-15T12:10:00Z"}
 * @architectural-role Business Logic / Discovery Engine
 * @description
 * Orchestrates the discovery of "Boundary Crossings." It identifies symbols 
 * imported by the context pack that reside outside its current scope. This 
 * logic is critical for Layer 2 of the context pack generation, preventing 
 * "Type Vacuums" by ensuring all external contracts are identified for extraction.
 * 
 * @core-principles
 * 1. IS the primary engine for identifying context leakage.
 * 2. MUST utilize pre-parsed ASTs to maintain high performance.
 * 3. DELEGATES path resolution to the specialized importResolver.
 * 4. IGNORES non-relative imports (third-party modules).
 * 
 * @api-declaration
 *   export function scanBoundaries(
 *     fileIndex: Map<string, FileEntry>,
 *     selectedFiles: SelectedFileMap
 *   ): BoundarySymbol[];
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import traverse from '@babel/traverse';
import type { FileEntry } from '../../../state/slicer-state';
import { resolveImportPath } from './importResolver';
import type { BoundarySymbol, SelectedFileMap } from './types';

/**
 * @id packages/core/src/logic/symbolGraph/boundaryScanner/index.ts#scanBoundaries
 * @description
 * Scans the provided ASTs to detect imports that cross the pack boundary. 
 * Returns a deduplicated list of BoundarySymbol objects containing the 
 * identifier and the absolute source path.
 * 
 * @param fileIndex - The global project file registry.
 * @param selectedFiles - Map of file paths to their pre-parsed Babel ASTs.
 */
export function scanBoundaries(
  fileIndex: Map<string, FileEntry>,
  selectedFiles: SelectedFileMap
): BoundarySymbol[] {
  const boundarySymbols = new Map<string, BoundarySymbol>();
  
  /**
   * Internal helper to create unique keys for deduplication.
   */
  const makeKey = (id: string, path: string) => `${path}#${id}`;

  // Iterate over every file currently in the selection
  for (const [filePath, ast] of selectedFiles.entries()) {
    try {
      traverse(ast, {
        ImportDeclaration(path) {
          const importSource = path.node.source.value;
          
          // Only process relative imports.
          // Third-party modules (node_modules) are handled by Layer 2 
          // only if specifically configured (currently out of scope).
          if (!importSource.startsWith('.')) {
            return;
          }

          const resolvedPath = resolveImportPath(filePath, importSource, fileIndex);
          
          // BOUNDARY CONDITION:
          // 1. The file exists in the project (is not a broken link).
          // 2. The file is NOT in the current selection set (it's a "leak").
          if (resolvedPath && fileIndex.has(resolvedPath) && !selectedFiles.has(resolvedPath)) {
            
            path.node.specifiers.forEach(spec => {
              let importedName = '';
              
              if (spec.type === 'ImportSpecifier') {
                // Handle named imports: { User } or { User as Member }
                importedName = spec.imported.type === 'Identifier' 
                  ? spec.imported.name 
                  : spec.imported.value;
              } else if (spec.type === 'ImportDefaultSpecifier') {
                // Handle default imports: import User from ...
                importedName = 'default';
              } else if (spec.type === 'ImportNamespaceSpecifier') {
                // Handle namespace imports: import * as Utils from ...
                importedName = '*'; 
              }

              if (importedName) {
                const key = makeKey(importedName, resolvedPath);
                if (!boundarySymbols.has(key)) {
                  boundarySymbols.set(key, {
                    identifier: importedName,
                    sourcePath: resolvedPath
                  });
                }
              }
            });
          }
        }
      });
    } catch (e) {
      // Logic errors in a single file should not crash the entire scanning process.
      console.warn(`[BoundaryScanner] Failed to traverse AST for: ${filePath}`, e);
    }
  }

  return Array.from(boundarySymbols.values());
}

// Re-export types for convenience
export * from './types';