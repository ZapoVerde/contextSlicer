/**
 * @file packages/core/src/logic/symbolGraph/analyzers/barrelDetector.ts
 * @stamp {"ts":"2026-02-14T07:22:00Z"}
 * @architectural-role Business Logic
 * @description
 * Implements a strict heuristic to determine if a source file acts as a "Barrel" 
 * (a file used solely to organize and re-export other modules). 
 * 
 * @core-principles
 * 1. IS a heuristic engine for identifying architectural "wormholes."
 * 2. OWNS the determination of logical passthrough status for files.
 * 3. MUST remain stateless and high-performance during graph analysis.
 * 
 * @api-declaration
 *   export function isBarrelFile(ast: Node): boolean;
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { Node } from '@babel/types';

/**
 * @id packages/core/src/logic/symbolGraph/analyzers/barrelDetector.ts#isBarrelFile
 * @description
 * Analyzes a Babel AST to see if it consists exclusively of imports and re-exports.
 * A "pure" barrel contains no internal logic, variable declarations, or 
 * side-effect-bearing statements.
 * 
 * @param ast - The parsed Babel File node.
 * @returns True if the file contains only re-exporting boilerplate.
 */
export function isBarrelFile(ast: Node): boolean {
  // Ensure we are looking at a File node
  if (ast.type !== 'File') return false;

  const body = ast.program.body;

  // An empty file is technically a passthrough, but usually not a barrel.
  // We return true if all statements are architectural/declarative.
  return body.every(node => {
    // 1. All import declarations are allowed in a barrel
    if (node.type === 'ImportDeclaration') {
      return true;
    }

    // 2. Wildcard re-exports: export * from './path'
    if (node.type === 'ExportAllDeclaration') {
      return true;
    }

    // 3. Named re-exports: export { a, b } from './path'
    // This is ONLY a barrel if it doesn't include an inline declaration 
    // like 'export const a = 1'.
    if (node.type === 'ExportNamedDeclaration') {
      // If .declaration is present, it's defining logic (Variable/Function/Class)
      return node.declaration === null;
    }

    // Any other statement (VariableDeclaration, FunctionDeclaration, 
    // ExpressionStatement, etc.) disqualifies the file from being a pure barrel.
    return false;
  });
}