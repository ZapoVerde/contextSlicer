/**
 * @file packages/core/src/logic/symbolGraph/summaryGenerator.ts
 * @stamp {"ts":"2026-02-14T13:10:00Z"}
 * @architectural-role Business Logic
 * @description
 * Transforms a file's Abstract Syntax Tree (AST) into a distilled semantic summary.
 * It classifies the file into architectural patterns based on symbol flow and 
 * extracts locally defined types to preserve contract clarity without implementation noise.
 * 
 * @core-principles
 * 1. IS a pure, stateless engine for architectural distillation.
 * 2. OWNS the heuristic for classifying files into [TRANSFORM], [CONSUME], [GENERATE], or [PASSTHROUGH].
 * 3. MUST focus exclusively on internal project symbols, omitting third-party noise.
 * 
 * @api-declaration
 *   export function generateSummary(filePath: string, ast: any, sourceCode: string): string;
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import traverse from '@babel/traverse';
import type { File } from '@babel/types';
import { isBarrelFile } from './analyzers/barrelDetector';

/**
 * @id packages/core/src/logic/symbolGraph/summaryGenerator.ts#generateSummary
 * @description
 * Analyzes the AST of a file to generate a structured summary including its 
 * architectural pattern, internal inputs, public outputs, and local type definitions.
 * 
 * @param filePath - The relative path of the file being summarized.
 * @param ast - The Babel AST of the file.
 * @param sourceCode - The raw source code string (required for literal type extraction).
 * @returns A formatted string containing the semantic summary.
 */
export function generateSummary(filePath: string, ast: File, sourceCode: string): string {
  const internalInputs = new Set<string>();
  const outputs = new Set<string>();
  const localTypes: string[] = [];

  // 1. Identify "Wormholes" immediately
  if (isBarrelFile(ast)) {
    return `// [PASSTHROUGH] ${filePath}\n// Summary: Pure organizational barrel or re-export pipe.`;
  }

  traverse(ast, {
    // Collect Internal Inputs (Relative Imports)
    ImportDeclaration(path) {
      const source = path.node.source.value;
      if (source.startsWith('.')) {
        path.node.specifiers.forEach((spec) => {
          if (spec.type === 'ImportSpecifier' && spec.imported.type === 'Identifier') {
            internalInputs.add(spec.imported.name);
          } else if (spec.type === 'ImportDefaultSpecifier') {
            internalInputs.add('default');
          }
        });
      }
    },

    // Collect Public Outputs (Exports)
    ExportNamedDeclaration(path) {
      if (path.node.declaration) {
        const decl = path.node.declaration;
        if (decl.type === 'VariableDeclaration') {
          decl.declarations.forEach((d) => {
            if (d.id.type === 'Identifier') outputs.add(d.id.name);
          });
        } else if ('id' in decl && decl.id?.type === 'Identifier') {
          outputs.add(decl.id.name);
        }
      }
      path.node.specifiers.forEach((spec) => {
        if (spec.exported.type === 'Identifier') {
          outputs.add(spec.exported.name);
        }
      });
    },
    ExportDefaultDeclaration() {
      outputs.add('default');
    },

    // Extract Local Type Definitions
    TSInterfaceDeclaration(path) {
      if (path.node.start !== null && path.node.end !== null) {
        localTypes.push(sourceCode.slice(path.node.start, path.node.end));
      }
    },
    TSTypeAliasDeclaration(path) {
      if (path.node.start !== null && path.node.end !== null) {
        localTypes.push(sourceCode.slice(path.node.start, path.node.end));
      }
    },
    TSEnumDeclaration(path) {
      if (path.node.start !== null && path.node.end !== null) {
        localTypes.push(sourceCode.slice(path.node.start, path.node.end));
      }
    }
  });

  // 2. Classify Architectural Pattern
  let pattern = 'TRANSFORM';
  if (outputs.size > 0 && internalInputs.size === 0) {
    pattern = 'GENERATE';
  } else if (outputs.size === 0 && internalInputs.size > 0) {
    pattern = 'CONSUME';
  } else if (outputs.size === 0 && internalInputs.size === 0) {
    pattern = 'ISOLATED';
  }

  // 3. Construct the Formatted String
  const lines: string[] = [
    `// [${pattern}] ${filePath}`,
    `// Inputs:  ${internalInputs.size > 0 ? Array.from(internalInputs).join(', ') : 'None (External/Root)'}`,
    `// Outputs: ${outputs.size > 0 ? Array.from(outputs).join(', ') : 'Internal Only'}`
  ];

  if (localTypes.length > 0) {
    lines.push('// Types Created:');
    localTypes.forEach(t => {
      // Indent types slightly for visual clarity in the pack
      lines.push(t.split('\n').map(l => `//   ${l}`).join('\n'));
    });
  }

  return lines.join('\n');
}