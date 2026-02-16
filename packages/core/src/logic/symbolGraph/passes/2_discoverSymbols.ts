/**
 * @file packages/core/src/logic/symbolGraph/passes/2_discoverSymbols.ts
 * @stamp {"ts":"2026-02-16T13:45:00Z"}
 * @architectural-role Business Logic / Utility
 * @description
 * Provides pure functions for identifying top-level symbol declarations within 
 * a Babel AST. This logic is used by both the main thread for graph indexing 
 * and by Web Workers for metadata distillation.
 *
 * @core-principles
 * 1. PURITY: Must remain stateless and side-effect free.
 * 2. CONSISTENCY: ENFORCES identical symbol discovery rules across all threads.
 * 3. COMPLIANCE: Returns a flat list of symbol names suitable for DistilledMetadata.
 *
 * @api-declaration
 *   export function discoverSymbolsInAst(ast: File): string[];
 *   export function discoverSymbols(astCache: Map<string, File>, graph: SymbolGraph, errors: string[]): void;
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import traverse from '@babel/traverse';
import type { File } from '@babel/types';
import type { SymbolGraph } from '../types.js';

/**
 * @id packages/core/src/logic/symbolGraph/passes/2_discoverSymbols.ts#discoverSymbolsInAst
 * @description
 * Scans a single AST for top-level declarations and exports.
 * 
 * @param ast - The Babel AST File node.
 * @returns A deduplicated list of symbol names found at the module root.
 */
export function discoverSymbolsInAst(ast: File): string[] {
  const symbols = new Set<string>();

  traverse(ast, {
    // 1. Named Exports and Declarations
    ExportNamedDeclaration(path) {
      const decl = path.node.declaration;
      if (decl) {
        if (decl.type === 'VariableDeclaration') {
          decl.declarations.forEach((d) => {
            if (d.id.type === 'Identifier') symbols.add(d.id.name);
          });
        } else if ('id' in decl && decl.id?.type === 'Identifier') {
          symbols.add(decl.id.name);
        }
      }
      path.node.specifiers.forEach((spec) => {
        if (spec.exported.type === 'Identifier') {
          symbols.add(spec.exported.name);
        }
      });
    },

    // 2. Default Exports
    ExportDefaultDeclaration() {
      symbols.add('default');
    },

    // 3. Top-level declarations (even if not exported, for internal graph linking)
    FunctionDeclaration(path) {
      if (path.parent.type === 'Program' && path.node.id) {
        symbols.add(path.node.id.name);
      }
    },
    ClassDeclaration(path) {
      if (path.parent.type === 'Program' && path.node.id) {
        symbols.add(path.node.id.name);
      }
    },
    TSInterfaceDeclaration(path) {
      if (path.parent.type === 'Program' && path.node.id) {
        symbols.add(path.node.id.name);
      }
    },
    TSTypeAliasDeclaration(path) {
      if (path.parent.type === 'Program' && path.node.id) {
        symbols.add(path.node.id.name);
      }
    },
    TSEnumDeclaration(path) {
      if (path.parent.type === 'Program' && path.node.id) {
        symbols.add(path.node.id.name);
      }
    }
  });

  return Array.from(symbols);
}

/**
 * @id packages/core/src/logic/symbolGraph/passes/2_discoverSymbols.ts#discoverSymbols
 * @description
 * Legacy orchestrator for main-thread graph building.
 * Populates a SymbolGraph based on a cache of ASTs.
 */
export function discoverSymbols(
  astCache: Map<string, File>,
  graph: SymbolGraph,
  errors: string[]
): void {
  for (const [filePath, ast] of astCache.entries()) {
    try {
      // Ensure file-level node exists
      if (!graph.has(filePath)) {
        graph.set(filePath, {
          id: filePath,
          filePath,
          symbolName: '(file)',
          dependencies: new Set(),
          dependents: new Set(),
        });
      }

      const symbolNames = discoverSymbolsInAst(ast);
      
      symbolNames.forEach(name => {
        const id = `${filePath}#${name}`;
        if (!graph.has(id)) {
          graph.set(id, {
            id,
            filePath,
            symbolName: name,
            dependencies: new Set(),
            dependents: new Set(),
          });
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`[Symbol Discovery Failed] ${filePath}: ${msg}`);
    }
  }
}