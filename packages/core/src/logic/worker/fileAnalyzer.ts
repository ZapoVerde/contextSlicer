/**
 * @file packages/core/src/logic/worker/fileAnalyzer.ts
 * @stamp {"ts":"2026-02-16T18:40:00Z"}
 * @architectural-role Business Logic / Logic Module
 * @description
 * Implements the "Semantic Miner" logic for the indexing phase. Parses source 
 * code into an AST to extract dependency edges, architectural flags, and 
 * distilled semantic contracts. Now includes a "Contract Brief" generator 
 * that summarizes public surface area and dependencies for LLM context.
 *
 * @core-principles
 * 1. IS a pure logic module for single-file analysis.
 * 2. OWNS the implementation of the Two-Part Pipe Detection Rule.
 * 3. MUST prioritize semantic density by virtualizing implementation bodies.
 *
 * @api-declaration
 *   export function analyzeFile(path: string, content: string): DistilledMetadata;
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import type { VariableDeclaration, FunctionDeclaration, Identifier } from '@babel/types';
import type { DistilledMetadata } from './types.js';
import { hasReexports, isBarrelFile } from '../symbolGraph/analyzers/barrelDetector.js';
import { hasLogicActivity } from '../symbolGraph/analyzers/flowAnalyzer.js';

/**
 * @id packages/core/src/logic/worker/fileAnalyzer.ts#analyzeFile
 * @description
 * Executes the full analysis pipeline for a single file. Extracts metadata
 * required for graph building and architectural distillation.
 * 
 * @param path - The project-relative path of the file.
 * @param content - The raw text content of the file.
 */
export function analyzeFile(path: string, content: string): DistilledMetadata {
  const ast = parser.parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
  });

  const reexports = hasReexports(ast);
  const logic = hasLogicActivity(ast);
  const barrel = isBarrelFile(ast);

  const symbols: string[] = [];
  const imports: string[] = [];
  
  const typeRegistry: Record<string, string> = {};
  const syntheticSignatures: Record<string, string> = {};

  // Structures for the Contract Brief
  const importSummary = new Map<string, string[]>();
  const exportSummary: string[] = [];

  traverse(ast, {
    ImportDeclaration(p) {
      const source = p.node.source.value;
      imports.push(source);

      const names: string[] = p.node.specifiers.map(spec => {
        if (spec.type === 'ImportSpecifier') {
          return (spec.imported as Identifier).name;
        }
        if (spec.type === 'ImportDefaultSpecifier') {
          return 'default';
        }
        if (spec.type === 'ImportNamespaceSpecifier') {
          return '*';
        }
        return '';
      }).filter(Boolean);

      const existing = importSummary.get(source) || [];
      importSummary.set(source, [...existing, ...names]);
    },

    ExportNamedDeclaration(p) {
      if (p.node.source) {
        imports.push(p.node.source.value);
        // Track re-exports in the import summary for dependency mapping
        const source = p.node.source.value;
        const names = p.node.specifiers.map(s => (s.exported as Identifier).name);
        const existing = importSummary.get(source) || [];
        importSummary.set(source, [...existing, ...names]);
      }
      
      const decl = p.node.declaration;
      if (!decl) {
        p.node.specifiers.forEach((spec) => {
          if (spec.exported.type === 'Identifier') {
            const name = spec.exported.name;
            symbols.push(name);
            exportSummary.push(name);
          }
        });
        return;
      }

      // --- 1. TYPE DEFINITIONS (Source Clipping) ---
      if (
        decl.type === 'TSInterfaceDeclaration' ||
        decl.type === 'TSTypeAliasDeclaration' ||
        decl.type === 'TSEnumDeclaration'
      ) {
        if (decl.id?.type === 'Identifier') {
          const name = decl.id.name;
          symbols.push(name);
          exportSummary.push(`${name} (Type)`);
          if (decl.start !== null && decl.end !== null) {
            typeRegistry[name] = content.slice(decl.start, decl.end);
          }
        }
      }
      
      // --- 2. VALUE DEFINITIONS (Signature Virtualization) ---
      else if (decl.type === 'VariableDeclaration') {
        const varDecl = decl as VariableDeclaration;
        varDecl.declarations.forEach((d) => {
          if (d.id.type === 'Identifier') {
            const name = d.id.name;
            symbols.push(name);
            exportSummary.push(`${name} (Variable)`);
            
            let signature = `export declare const ${name}`;
            if (d.id.typeAnnotation && d.id.typeAnnotation.start !== null && d.id.typeAnnotation.end !== null) {
              const typeStr = content.slice(d.id.typeAnnotation.start, d.id.typeAnnotation.end);
              signature += `${typeStr};`;
            } else {
              signature += ': any;';
            }
            syntheticSignatures[name] = signature;
          }
        });
      }
      else if (decl.type === 'FunctionDeclaration') {
        const funcDecl = decl as FunctionDeclaration;
        if (funcDecl.id?.type === 'Identifier') {
          const name = funcDecl.id.name;
          symbols.push(name);
          exportSummary.push(`${name} (Function)`);
          
          let signature = `export declare function ${name}`;
          
          if (funcDecl.typeParameters && funcDecl.typeParameters.start !== null && funcDecl.typeParameters.end !== null) {
             signature += content.slice(funcDecl.typeParameters.start, funcDecl.typeParameters.end);
          }

          signature += '(';
          signature += funcDecl.params.map(param => {
            if (param.start !== null && param.end !== null) {
              return content.slice(param.start, param.end);
            }
            return 'arg: any';
          }).join(', ');
          signature += ')';

          if (funcDecl.returnType && funcDecl.returnType.start !== null && funcDecl.returnType.end !== null) {
            signature += content.slice(funcDecl.returnType.start, funcDecl.returnType.end);
          } else {
             signature += ': any';
          }
          
          signature += ';';
          syntheticSignatures[name] = signature;
        }
      }
      else if (decl.type === 'ClassDeclaration') {
        if (decl.id?.type === 'Identifier') {
           const name = decl.id.name;
           symbols.push(name);
           exportSummary.push(`${name} (Class)`);
           syntheticSignatures[name] = `export declare class ${name} { /* implementation omitted */ }`;
        }
      }
    },

    ExportDefaultDeclaration() {
      symbols.push('default');
      exportSummary.push('default');
    },

    ExportAllDeclaration(p) {
      imports.push(p.node.source.value);
      const source = p.node.source.value;
      const existing = importSummary.get(source) || [];
      importSummary.set(source, [...existing, '* (Wildcard Re-export)']);
    }
  });

  return {
    filePath: path,
    symbols: Array.from(new Set(symbols)),
    imports: Array.from(new Set(imports)),
    hasReexports: reexports,
    hasLogicActivity: logic,
    isBarrel: barrel,
    typeRegistry,
    syntheticSignatures,
    contractBrief: formatContractBrief(importSummary, exportSummary)
  };
}

/**
 * Formats captured import and export data into a clean text block for the pack.
 */
function formatContractBrief(importMap: Map<string, string[]>, exports: string[]): string {
  const lines: string[] = ['\n--- STRUCTURAL CONTRACT ---'];
  
  if (importMap.size > 0) {
    lines.push('IMPORTS:');
    importMap.forEach((names, source) => {
      lines.push(`  - { ${names.join(', ')} } from '${source}'`);
    });
  }

  if (exports.length > 0) {
    lines.push('EXPORTS:');
    exports.forEach(exp => lines.push(`  - ${exp}`));
  }

  return lines.join('\n');
}