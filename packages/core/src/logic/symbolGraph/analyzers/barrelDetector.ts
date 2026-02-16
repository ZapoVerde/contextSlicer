/**
 * @file packages/core/src/logic/symbolGraph/analyzers/barrelDetector.ts
 * @stamp {"ts":"2026-02-15T19:20:00Z"}
 * @architectural-role Business Logic
 * @description
 * Implements structural analysis heuristics to identify re-export patterns. 
 * Supports the Two-Part Pipe Detection Rule by distinguishing between files 
 * that merely move symbols (Barrels) and files that potentially contain logic.
 * 
 * @core-principles
 * 1. IS a structural analyzer for ESM export patterns.
 * 2. OWNS the identification of Part 1 of the Pipe Rule (Presence of re-exports).
 * 3. MUST remain stateless and pure.
 * 
 * @api-declaration
 *   export function hasReexports(ast: Node): boolean;
 *   export function isBarrelFile(ast: Node): boolean;
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import type { Node } from '@babel/types';

/**
 * @id packages/core/src/logic/symbolGraph/analyzers/barrelDetector.ts#hasReexports
 * @description
 * Part 1 of the Pipe Detection Rule. Checks if a file contains any re-export statements
 * that move symbols from an external source to its own export surface.
 * 
 * @example
 * export * from './module'; // true
 * export { a } from './module'; // true
 * export const a = 1; // false
 * 
 * @param ast - The parsed Babel File node.
 * @returns True if the file contains at least one re-export statement.
 */
export function hasReexports(ast: Node): boolean {
  if (ast.type !== 'File') return false;

  const body = ast.program.body;

  return body.some(node => {
    // Case A: export * from './path'
    if (node.type === 'ExportAllDeclaration') {
      return true;
    }

    // Case B: export { x } from './path'
    // It is only a re-export if it has a 'source' (the from clause)
    if (node.type === 'ExportNamedDeclaration' && node.source !== null) {
      return true;
    }

    return false;
  });
}

/**
 * @id packages/core/src/logic/symbolGraph/analyzers/barrelDetector.ts#isBarrelFile
 * @description
 * Determines if a file is a "Pure Barrel". A pure barrel consists exclusively 
 * of imports and re-exports, containing no internal logic or variable declarations.
 * 
 * @param ast - The parsed Babel File node.
 * @returns True if the file is strictly a structural passthrough.
 */
export function isBarrelFile(ast: Node): boolean {
  if (ast.type !== 'File') return false;

  const body = ast.program.body;
  if (body.length === 0) return false;

  return body.every(node => {
    // 1. Standard imports are allowed
    if (node.type === 'ImportDeclaration') {
      return true;
    }

    // 2. Wildcard re-exports are allowed
    if (node.type === 'ExportAllDeclaration') {
      return true;
    }

    // 3. Named re-exports are allowed ONLY if they are passthroughs
    if (node.type === 'ExportNamedDeclaration') {
      // Must have a source (re-export) and NO internal declaration
      return node.source !== null && node.declaration === null;
    }

    // Any logic, local variables, or function definitions disqualify it
    return false;
  });
}