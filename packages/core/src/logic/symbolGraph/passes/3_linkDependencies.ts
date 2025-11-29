/**
 * @file packages/core/src/logic/symbolGraph/passes/3_linkDependencies.ts
 * @stamp {"ts":"2025-11-29T03:35:00Z"}
 * @architectural-role Dependency Linking Pass
 *
 * @description
 * Pass 3 of the graph builder. It analyzes imports to connect nodes in the graph.
 * It is hardened against AST traversal errors to prevent crashes on specific
 * file edge-cases.
 *
 * @core-principles
 * 1. IS responsible for creating edges (dependencies) between nodes.
 * 2. MUST gracefully handle files that cannot be traversed (e.g. Babel bugs).
 * 3. DELEGATES resolution logic to the PathResolver.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Mutates the passed graph and error array.
 *     state_ownership: none
 *     external_io: none
 */

import traverse, { NodePath } from '@babel/traverse';
import type { Node, ImportDeclaration } from '@babel/types';
import type { SymbolGraph } from '../types';
import { PathResolver } from '../pathResolver';
import { resolveExport } from '../astUtils';

type AstCache = Map<string, Node>;

function getIdentifierName(node: import('@babel/types').Identifier | import('@babel/types').StringLiteral): string {
  return node.type === 'Identifier' ? node.name : node.value;
}

export function linkDependencies(
  astCache: AstCache,
  graph: SymbolGraph,
  pathResolver: PathResolver,
  errors: string[]
): void {
  for (const [filePath, ast] of astCache.entries()) {
    try {
      traverse(ast, {
        ImportDeclaration(path: NodePath<ImportDeclaration>) {
          
          const sourcePath = pathResolver.resolve(filePath, path.node.source.value, errors);
          
          if (!sourcePath) return; // Cannot resolve import, likely a node_module 

          for (const specifier of path.node.specifiers) {
            let importedName: string | null = null;
            if (specifier.type === 'ImportSpecifier') {
              importedName = getIdentifierName(specifier.imported);
            } else if (specifier.type === 'ImportDefaultSpecifier') {
              importedName = 'default';
            }

            if (importedName) {
              const exporterId = resolveExport(sourcePath, importedName, astCache, pathResolver, errors);
              if (exporterId && graph.has(exporterId)) {
                const importerFileNode = graph.get(filePath)!;
                const exporterNode = graph.get(exporterId)!;

                // Always create a robust, file-level dependency link.
                importerFileNode.dependencies.add(exporterId);
                exporterNode.dependents.add(filePath);

                // Attempt to create a more granular, symbol-level link.
                const binding = path.scope.getBinding(specifier.local.name);
                if (binding) {
                  for (const refPath of binding.referencePaths) {
                    const importerScope = refPath.findParent(
                      (p: NodePath) =>
                        p.isFunctionDeclaration() ||
                        p.isClassDeclaration() ||
                        p.isVariableDeclarator()
                    );
                    if (
                      importerScope?.isVariableDeclarator() &&
                      importerScope.node.id.type === 'Identifier'
                    ) {
                      const importerId = `${filePath}#${importerScope.node.id.name}`;
                      if (graph.has(importerId)) {
                        graph.get(importerId)!.dependencies.add(exporterId);
                        exporterNode.dependents.add(importerId);
                      }
                    } else if (
                      (importerScope?.isFunctionDeclaration() ||
                        importerScope?.isClassDeclaration()) &&
                      importerScope.node.id
                    ) {
                      const importerId = `${filePath}#${importerScope.node.id.name}`;
                      if (graph.has(importerId)) {
                        graph.get(importerId)!.dependencies.add(exporterId);
                        exporterNode.dependents.add(importerId);
                      }
                    }
                  }
                }
              }
            }
          }
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // Log to console for dev debugging, but push to user-facing errors
      console.warn(`[Linker] Failed to traverse ${filePath}: ${msg}`);
      errors.push(`[Dependency Linking Failed] ${filePath}: ${msg}`);
    }
  }
}