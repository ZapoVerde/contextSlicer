/**
 * @file packages/core/src/logic/symbolGraph/astUtils.ts
 * @stamp {"ts":"2026-02-14T07:18:00Z"}
 * @architectural-role Utility
 * @description
 * Shared utility functions for navigating and analyzing Babel Abstract Syntax Trees.
 * Provides helpers for identifier extraction and cross-file export resolution.
 * 
 * @core-principles
 * 1. IS a collection of stateless, pure helper functions.
 * 2. OWNS the complexity of AST node type discrimination.
 * 3. MUST NOT maintain any internal state or perform I/O.
 * 
 * @api-declaration
 *   export function getIdentifierName(node: Node): string;
 *   export function resolveExport(...): string | null;
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
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
  StringLiteral,
} from '@babel/types';
import { PathResolver } from './pathResolver';

type AstCache = Map<string, Node>;

/**
 * @id packages/core/src/logic/symbolGraph/astUtils.ts#getIdentifierName
 * @description
 * Safely extracts a string name from an Identifier or StringLiteral node.
 */
export function getIdentifierName(node: Identifier | StringLiteral): string {
  return node.type === 'Identifier' ? node.name : node.value;
}

/**
 * @id packages/core/src/logic/symbolGraph/astUtils.ts#resolveExport
 * @description
 * Recursively traces an export back to its original declaration across the AST cache.
 * Handles re-exports and wildcard exports.
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
  if (visited.has(cacheKey)) return null; 
  visited.add(cacheKey);

  const ast = astCache.get(targetPath);
  if (!ast) return null;

  let foundOrigin: string | null = null;

  traverse(ast, {
    ExportNamedDeclaration(path: NodePath<ExportNamedDeclaration>) {
      if (path.node.source) {
        const sourcePath = pathResolver.resolve(targetPath, path.node.source.value, errors);
        if (sourcePath) {
          for (const specifier of path.node.specifiers) {
            if (
              specifier.type === 'ExportSpecifier' &&
              getIdentifierName(specifier.exported as Identifier) === symbolName
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