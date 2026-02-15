/**
 * @file packages/core/src/logic/symbolGraph/summaryGenerator.ts
 * @stamp {"ts":"2026-02-15T10:15:00Z"}
 * @architectural-role Business Logic
 * @description
 * Distills a file's source code into a semantic architectural brief. It extracts 
 * the primary documentation block (the "Intent"), public API surfaces (the "Contract"), 
 * and critical type definitions. This summary is used for distant dependencies 
 * to preserve context while minimizing token consumption.
 * 
 * @core-principles
 * 1. IS a pure, stateless engine for architectural distillation.
 * 2. MUST prioritize human-written intent (docblocks) over raw implementation.
 * 3. ENFORCES token efficiency by truncating large type definitions.
 * 
 * @api-declaration
 *   export function generateSummary(filePath: string, ast: File, sourceCode: string): string;
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

  // 1. Identify Architectural Wormholes (Barrels)
  if (isBarrelFile(ast)) {
    return `=== ${filePath} ===\n[SUMMARY - Dependency Brief]\n\n[PASSTHROUGH]\nPurpose: Pure organizational barrel or re-export pipe.`;
  }

  // 2. Extract Intent (The full first block comment)
  const firstBlockComment = ast.comments?.find(c => c.type === 'CommentBlock');
  const docblock = firstBlockComment ? `/*${firstBlockComment.value}*/` : '';

  // 3. Extract API Contract via AST
  traverse(ast, {
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

    ExportNamedDeclaration(path) {
      if (path.node.declaration) {
        const decl = path.node.declaration;
        if (decl.type === 'VariableDeclaration') {
          decl.declarations.forEach((d) => {
            if (d.id.type === 'Identifier') outputs.add(d.id.name);
          });
        } else if ('id' in decl && (decl as any).id?.type === 'Identifier') {
          outputs.add((decl as any).id.name);
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

  // 4. Determine Architectural Pattern
  let pattern = 'TRANSFORM';
  if (outputs.size > 0 && internalInputs.length === 0) {
    pattern = 'GENERATE';
  } else if (outputs.size === 0 && internalInputs.length > 0) {
    pattern = 'CONSUME';
  } else if (outputs.size === 0 && internalInputs.length === 0) {
    pattern = 'ISOLATED';
  }

  // 5. Assembly
  const brief: string[] = [
    `=== ${filePath} ===`,
    `[SUMMARY - Dependency Brief]`,
    ''
  ];

  if (docblock) {
    brief.push(docblock);
    brief.push('');
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
 * Summarizes a type definition surface to save tokens.
 * Preserves the name and structure but truncates deeply nested bodies.
 */
function summarizeTypeNode(source: string, node: any): string {
  if (node.start === null || node.end === null) return '';
  
  const raw = source.slice(node.start, node.end);
  const lines = raw.split('\n');
  
  if (lines.length <= 10) return raw;

  const header = lines[0];
  const tail = lines[lines.length - 1];
  const visibleFields = lines.slice(1, 4).map(l => l.trim()).join('\n    ');
  
  return `${header}\n    ${visibleFields}\n    // ... ${lines.length - 5} more fields\n  ${tail}`;
}