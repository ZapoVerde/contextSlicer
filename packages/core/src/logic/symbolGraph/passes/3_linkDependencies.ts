/**
 * @file packages/core/src/logic/symbolGraph/passes/3_linkDependencies.ts
 * @stamp {"ts":"2026-02-15T23:55:00Z"}
 * @architectural-role Dependency Linking Pass
 *
 * @description
 * Pass 3 of the graph builder. It analyzes import and re-export statements to 
 * connect file nodes in the dependency graph.
 * 
 * ARCHITECTURAL CHANGE (v2.1):
 * This pass now builds a PHYSICAL dependency graph, linking files to their 
 * immediate imports/exports rather than resolving deeply to the symbol definition.
 * This is critical for the "Smart Tracer" to correctly identify and traverse 
 * intermediate "Pipe" files (Barrels) instead of bypassing them via "Deep Links".
 *
 * @core-principles
 * 1. ENFORCES immediate physical connectivity (File A -> Barrel B -> File C).
 * 2. MUST process `ImportDeclaration`, `ExportAllDeclaration`, and `ExportNamedDeclaration`.
 * 3. DELEGATES path resolution to the PathResolver.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Mutates the passed graph and error array.
 *     state_ownership: none
 *     external_io: none
 */

import traverse, { NodePath } from '@babel/traverse';
import type { Node, ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration } from '@babel/types';
import type { SymbolGraph } from '../types';
import { PathResolver } from '../pathResolver';

type AstCache = Map<string, Node>;

export function linkDependencies(
  astCache: AstCache,
  graph: SymbolGraph,
  pathResolver: PathResolver,
  errors: string[]
): void {
  for (const [filePath, ast] of astCache.entries()) {
    try {
      // We only care about the file node for physical linking
      const importerNode = graph.get(filePath);
      if (!importerNode) continue;

      /**
       * Helper to create a physical edge between the current file and the resolved source.
       */
      const linkTo = (sourceValue: string) => {
        const resolvedPath = pathResolver.resolve(filePath, sourceValue, errors);
        
        if (resolvedPath && graph.has(resolvedPath)) {
          const exporterNode = graph.get(resolvedPath)!;
          
          // Create bidirectional edges
          importerNode.dependencies.add(resolvedPath);
          exporterNode.dependents.add(filePath);
        }
      };

      traverse(ast, {
        // 1. Standard Imports: import ... from './foo'
        ImportDeclaration(path: NodePath<ImportDeclaration>) {
          if (path.node.source) {
            linkTo(path.node.source.value);
          }
        },

        // 2. Wildcard Re-exports: export * from './foo'
        ExportAllDeclaration(path: NodePath<ExportAllDeclaration>) {
          if (path.node.source) {
            linkTo(path.node.source.value);
          }
        },

        // 3. Named Re-exports: export { x } from './foo'
        ExportNamedDeclaration(path: NodePath<ExportNamedDeclaration>) {
          if (path.node.source) {
            linkTo(path.node.source.value);
          }
        }
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Log to console for dev debugging, but push to user-facing errors
      console.warn(`[Linker] Failed to traverse ${filePath}: ${msg}`);
      errors.push(`[Dependency Linking Failed] ${filePath}: ${msg}`);
    }
  }
}