/**
 * @file packages/core/src/logic/worker/worker.ts
 * @stamp {"ts":"2026-02-16T11:45:00Z"}
 * @architectural-role Business Logic / Worker Entry Point
 * @description
 * The stateless execution engine for background file analysis. It executes 
 * the "Parse -> Analyze -> Distill" pipeline, returning lightweight metadata 
 * to the main thread. Updated to extract import paths for graph linking.
 *
 * @core-principles
 * 1. ENFORCES the "Zero-AST Return" policy to prevent serialization overhead.
 * 2. MUST remain stateless between tasks.
 * 3. OWNS the extraction of dependency edges (imports/re-exports).
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import type { WorkerTask, WorkerResult, DistilledMetadata } from './types.js';
import { hasReexports, isBarrelFile } from '../symbolGraph/analyzers/barrelDetector.js';
import { hasLogicActivity } from '../symbolGraph/analyzers/flowAnalyzer.js';

/**
 * Listens for tasks from the Main Thread.
 */
self.onmessage = async (event: MessageEvent<WorkerTask>) => {
  const { taskId, type, payload } = event.data;

  try {
    if (type === 'ANALYZE_FILE') {
      const result = analyzeFile(payload.path, payload.content);
      const response: WorkerResult = { taskId, payload: result };
      self.postMessage(response);
    } else if (type === 'INITIALIZE') {
      self.postMessage({ taskId, error: undefined });
    }
  } catch (err) {
    self.postMessage({
      taskId,
      error: err instanceof Error ? err.message : 'Unknown worker error',
    });
  }
};

/**
 * Executes the analysis pipeline for a single file.
 * Extracts symbols (Nodes) and imports (Edges).
 */
function analyzeFile(path: string, content: string): DistilledMetadata {
  // 1. Parse into AST
  const ast = parser.parse(content, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
    errorRecovery: true,
  });

  // 2. Structural Analysis (Pipe Detection Rule)
  const reexports = hasReexports(ast);
  const logic = hasLogicActivity(ast);
  const barrel = isBarrelFile(ast);

  // 3. Metadata Extraction
  const symbols: string[] = [];
  const imports: string[] = [];

  traverse(ast, {
    // A. Detect Standard Imports: import { x } from './path'
    ImportDeclaration(p) {
      imports.push(p.node.source.value);
    },

    // B. Detect Named Exports / Re-exports
    ExportNamedDeclaration(p) {
      // If it has a source, it's a re-export (Edge)
      if (p.node.source) {
        imports.push(p.node.source.value);
      }

      // Collect defined symbols (Nodes)
      if (p.node.declaration) {
        const decl = p.node.declaration;
        if (decl.type === 'VariableDeclaration') {
          decl.declarations.forEach((d) => {
            if (d.id.type === 'Identifier') symbols.push(d.id.name);
          });
        } else if ('id' in decl && (decl as any).id?.type === 'Identifier') {
          symbols.push((decl as any).id.name);
        }
      }
      p.node.specifiers.forEach((spec) => {
        if (spec.exported.type === 'Identifier') {
          symbols.push(spec.exported.name);
        }
      });
    },

    // C. Detect Wildcard Re-exports: export * from './path'
    ExportAllDeclaration(p) {
      imports.push(p.node.source.value);
    },

    // D. Detect Default Exports
    ExportDefaultDeclaration() {
      symbols.push('default');
    }
  });

  return {
    filePath: path,
    symbols: Array.from(new Set(symbols)),
    imports: Array.from(new Set(imports)), // Deduplicate paths
    hasReexports: reexports,
    hasLogicActivity: logic,
    isBarrel: barrel
  };
}