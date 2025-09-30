/**
 * @file src/features/sourceDump/logic/symbolGraph/astUtils.ts
 * @architectural-role Logic Utility / AST Helpers
 *
 * @description This module provides a collection of helper functions for working with
 * Abstract Syntax Trees (ASTs). It encapsulates complex, reusable logic, such as
 * recursively resolving the origin of an exported symbol.
 *
 * @responsibilities
 * 1.  **Export Resolution:** Contains the `resolveExport` function, which is the most
 *     complex helper. It traverses the ASTs of multiple files to trace a named export
 *     back to its original declaration, handling re-exports (`export * from ...`) and
 *     named re-exports (`export { a } from ...`).
 * 2.  **Identifier Handling:** Provides smaller utility functions, like `getIdentifierName`,
 *     to safely extract the name from different types of AST nodes.
 */
import traverse, { NodePath } from '@babel/traverse';
import type {
  Node,
  ExportNamedDeclaration,
  ExportAllDeclaration,
  FunctionDeclaration,
  ClassDeclaration,
  TSEnumDeclaration,
  TSInterfaceDeclaration,
  TSTypeAliasDeclaration,
  VariableDeclarator,
  Identifier,
} from '@babel/types';
import { PathResolver } from './pathResolver';

type AstCache = Map<string, Node>;

function getIdentifierName(node: Identifier | import('@babel/types').StringLiteral): string {
  return node.type === 'Identifier' ? node.name : node.value;
}

/**
 * Recursively traces an export to its original declaration across multiple files.
 * @returns The final symbol ID (e.g., 'path/to/origin.ts#symbolName') or null.
 */
export function resolveExport(
  targetPath: string,
  symbolName: string,
  astCache: AstCache,
  pathResolver: PathResolver,
  errors: string[],
  visited = new Set<string>()
): string | null {
  const cacheKey = `${targetPath}#${symbolName}`;
  if (visited.has(cacheKey)) return null; // Avoid circular dependency loops
  visited.add(cacheKey);

  const ast = astCache.get(targetPath);
  if (!ast) return null;

  let foundOrigin: string | null = null;

  // Look for re-exports (e.g., `export { MyClass } from './MyClass'`)
  traverse(ast, {
    ExportNamedDeclaration(path: NodePath<ExportNamedDeclaration>) {
      if (path.node.source) {
          const sourcePath = pathResolver.resolve(targetPath, path.node.source.value, errors);
        if (sourcePath) {
          for (const specifier of path.node.specifiers) {
            if (
              specifier.type === 'ExportSpecifier' &&
              getIdentifierName(specifier.exported) === symbolName
            ) {
              foundOrigin = resolveExport(
                sourcePath,
                specifier.local.name,
                astCache,
                pathResolver,
                errors,
                visited
              );
              path.stop();
            }
          }
        }
      }
    },
    // Look for wildcard re-exports (e.g., `export * from './components'`)
    ExportAllDeclaration(path: NodePath<ExportAllDeclaration>) {
      const sourcePath = pathResolver.resolve(targetPath, path.node.source.value, errors);
      if (sourcePath) {
        const potentialOrigin = resolveExport(sourcePath, symbolName, astCache, pathResolver, errors, visited);
        if (potentialOrigin) {
          foundOrigin = potentialOrigin;
        }
      }
    },
  });

  if (foundOrigin) {
    return foundOrigin;
  }

  // If not re-exported, check if it's declared locally in this file.
  let isDeclaredLocally = false;
  const declarationVisitor = (
    path: NodePath<
      | FunctionDeclaration
      | ClassDeclaration
      | TSEnumDeclaration
      | TSInterfaceDeclaration
      | TSTypeAliasDeclaration
      | VariableDeclarator
    >
  ) => {
    let idNode: Node | null = null;
    if ('id' in path.node && path.node.id) {
      idNode = path.node.id;
    }
    if (idNode && idNode.type === 'Identifier' && idNode.name === symbolName) {
      isDeclaredLocally = true;
      path.stop();
    }
  };

  traverse(ast, {
    FunctionDeclaration: declarationVisitor,
    ClassDeclaration: declarationVisitor,
    TSEnumDeclaration: declarationVisitor,
    TSInterfaceDeclaration: declarationVisitor,
    TSTypeAliasDeclaration: declarationVisitor,
    VariableDeclarator: declarationVisitor,
    ExportDefaultDeclaration() {
      if (symbolName === 'default') {
        isDeclaredLocally = true;
      }
    },
  });

  if (isDeclaredLocally) {
    return `${targetPath}#${symbolName}`;
  }

  return null;
}