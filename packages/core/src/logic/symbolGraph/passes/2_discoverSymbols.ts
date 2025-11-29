/**
 * @file packages/core/src/logic/symbolGraph/passes/2_discoverSymbols.ts
 * @stamp {"ts":"2025-11-29T03:30:00Z"}
 * @architectural-role Symbol Discovery Pass
 *
 * @description
 * Pass 2 of the graph builder. It traverses the ASTs to identify all top-level
 * symbol declarations (classes, functions, variables) and creates the initial
 * nodes in the graph. It captures traversal errors to ensure robust execution.
 *
 * @core-principles
 * 1. IS responsible for population of the graph nodes.
 * 2. MUST NOT crash the entire process due to a single malformed file.
 * 3. DELEGATES error reporting to the shared error collection.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Mutates the passed graph and error array.
 *     state_ownership: none
 *     external_io: none
 */

import traverse, { NodePath } from '@babel/traverse';
import type {
  Node,
  FunctionDeclaration,
  ClassDeclaration,
  TSEnumDeclaration,
  TSInterfaceDeclaration,
  TSTypeAliasDeclaration,
  VariableDeclaration,
} from '@babel/types';
import type { SymbolGraph } from '../types';

type AstCache = Map<string, Node>;

export function discoverSymbols(
  astCache: AstCache, 
  graph: SymbolGraph,
  errors: string[]
): void {
  for (const [filePath, ast] of astCache.entries()) {
    // Ensure a file-level node exists for every file.
    if (!graph.has(filePath)) {
      graph.set(filePath, {
        id: filePath,
        filePath: filePath,
        symbolName: '(file)',
        dependencies: new Set(),
        dependents: new Set(),
      });
    }

    // Helper to create a new symbol node if it doesn't already exist.
    const createNode = (name: string) => {
      const id = `${filePath}#${name}`;
      if (!graph.has(id)) {
        graph.set(id, {
          id,
          filePath: filePath,
          symbolName: name,
          dependencies: new Set(),
          dependents: new Set(),
        });
      }
    };

    const declarationVisitor = (
      path: NodePath<
        FunctionDeclaration | ClassDeclaration | TSEnumDeclaration | TSInterfaceDeclaration | TSTypeAliasDeclaration
      >
    ) => {
      if (path.node.id?.name) {
        createNode(path.node.id.name);
      }
    };

    try {
      traverse(ast, {
        FunctionDeclaration: declarationVisitor,
        ClassDeclaration: declarationVisitor,
        TSEnumDeclaration: declarationVisitor,
        TSInterfaceDeclaration: declarationVisitor,
        TSTypeAliasDeclaration: declarationVisitor,
        VariableDeclaration(path: NodePath<VariableDeclaration>) {
          // Only consider variables declared at the top level of the module.
          if (path.parent.type === 'Program' || path.parent.type === 'ExportNamedDeclaration') {
            for (const decl of path.node.declarations) {
              if (decl.id.type === 'Identifier') {
                createNode(decl.id.name);
              }
            }
          }
        },
        ExportDefaultDeclaration() {
          createNode('default');
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // We push to the error array so the user can see which files were skipped
      errors.push(`[Symbol Discovery Failed] ${filePath}: ${msg}`);
    }
  }
}