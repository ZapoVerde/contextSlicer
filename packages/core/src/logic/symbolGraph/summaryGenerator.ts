/**
 * @file packages/core/src/logic/symbolGraph/summaryGenerator.ts
 * @stamp {"ts":"2026-02-15T09:15:00Z"}
 * @architectural-role Business Logic
 * @description
 * Transforms a file's Abstract Syntax Tree (AST) into a distilled semantic summary.
 * It classifies files into architectural patterns and extracts locally defined
 * types to preserve contract clarity. Updated to provide a "Developer Brief" 
 * format optimized for AI context and token efficiency.
 * 
 * @core-principles
 * 1. IS a pure, stateless engine for architectural distillation.
 * 2. OWNS the heuristic for classifying files into [TRANSFORM], [CONSUME], [GENERATE], or [PASSTHROUGH].
 * 3. MUST prioritize symbol provenance (source paths) and type surfaces.
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

interface SymbolProvenance {
  name: string;
  source: string;
}

/**
 * @id packages/core/src/logic/symbolGraph/summaryGenerator.ts#generateSummary
 * @description
 * Analyzes the AST of a file to generate a structured "Developer Brief" including 
 * its pattern, inputs with provenance, and summarized type surfaces.
 */
export function generateSummary(filePath: string, ast: File, sourceCode: string): string {
  const internalInputs: SymbolProvenance[] = [];
  const outputs = new Set<string>();
  const typeDefinitions: string[] = [];
  let purpose = '';

  // 1. Identify Architectural Wormholes
  if (isBarrelFile(ast)) {
    return `=== ${filePath} ===\n\n[PASSTHROUGH]\nPurpose: Pure organizational barrel or re-export pipe.`;
  }

  // 2. Extract Purpose (Heuristic: First block comment or leading JSDoc)
  const leadingComments = ast.program.body[0]?.leadingComments;
  if (leadingComments && leadingComments.length > 0) {
    const firstComment = leadingComments[0].value.trim();
    // Clean up JSDoc stars
    purpose = firstComment.replace(/^\*+/, '').replace(/\n\s*\*+/g, '\n').trim().split('\n')[0];
  }

  traverse(ast, {
    // Collect Inputs with Provenance
    ImportDeclaration(path) {
      const source = path.node.source.value;
      path.node.specifiers.forEach((spec) => {
        let name = '';
        if (spec.type === 'ImportSpecifier' && spec.imported.type === 'Identifier') {
          name = spec.imported.name;
        } else if (spec.type === 'ImportDefaultSpecifier') {
          name = 'default';
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          name = '*';
        }

        if (name) {
          internalInputs.push({ name, source });
        }
      });
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

    // Extract Type Surfaces (with token optimization)
    TSInterfaceDeclaration(path) {
      typeDefinitions.push(summarizeTypeNode(sourceCode, path.node));
    },
    TSTypeAliasDeclaration(path) {
      typeDefinitions.push(summarizeTypeNode(sourceCode, path.node));
    },
    TSEnumDeclaration(path) {
      typeDefinitions.push(summarizeTypeNode(sourceCode, path.node));
    }
  });

  // 3. Pattern Classification
  let pattern = 'TRANSFORM';
  if (outputs.size > 0 && internalInputs.length === 0) {
    pattern = 'GENERATE';
  } else if (outputs.size === 0 && internalInputs.length > 0) {
    pattern = 'CONSUME';
  } else if (outputs.size === 0 && internalInputs.length === 0) {
    pattern = 'ISOLATED';
  }

  // 4. Formatting Assembly
  const brief: string[] = [`=== ${filePath} ===`];
  
  if (purpose) {
    brief.push(`Purpose: ${purpose}`);
  }

  if (internalInputs.length > 0) {
    const inStr = internalInputs
      .map(i => `${i.name} (${i.source})`)
      .join(', ');
    brief.push(`IN: ${inStr}`);
  }

  const outList = Array.from(outputs);
  brief.push(`[${pattern}] → ${outList.length > 0 ? outList.join(', ') : 'Internal Only'}`);

  if (typeDefinitions.length > 0) {
    brief.push('\nTYPES DEFINED:');
    typeDefinitions.forEach(t => brief.push(`  ${t}`));
  }

  return brief.join('\n');
}

/**
 * Summarizes a type definition to its essential surface to save tokens.
 * Truncates long bodies but preserves field names and basic inheritance.
 */
function summarizeTypeNode(source: string, node: any): string {
  if (node.start === null || node.end === null) return '';
  
  const raw = source.slice(node.start, node.end);
  const lines = raw.split('\n');
  
  if (lines.length <= 8) return raw;

  // Pattern: Extract header and first few fields, then truncate
  const header = lines[0];
  const tail = lines[lines.length - 1];
  const visibleFields = lines.slice(1, 4).map(l => l.trim()).join('\n    ');
  
  return `${header}\n    ${visibleFields}\n    // ... ${lines.length - 5} more fields\n  ${tail}`;
}