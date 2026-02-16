/**
 * @file packages/core/src/logic/worker/worker.ts
 * @stamp {"ts":"2026-02-16T15:35:00Z"}
 * @architectural-role Business Logic / Worker Entry Point
 * @description
 * The stateless execution engine for background file analysis and Context Pack assembly.
 * It executes the "Parse -> Analyze -> Distill" pipeline for indexing, and the 
 * "Pre-flight -> Boundary Scan -> Assembly -> Tokenize" pipeline for generation.
 *
 * @core-principles
 * 1. ENFORCES the "Zero-AST Return" policy to prevent serialization overhead.
 * 2. MUST remain stateless between tasks.
 * 3. OWNS the accurate token counting via Tiktoken (cl100k_base).
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { getEncoding } from 'js-tiktoken';
import type { File } from '@babel/types';

import type { WorkerTask, WorkerResult, DistilledMetadata, AssemblyPayload, AssemblyResult } from './types.js';
import { hasReexports, isBarrelFile } from '../symbolGraph/analyzers/barrelDetector.js';
import { hasLogicActivity } from '../symbolGraph/analyzers/flowAnalyzer.js';

// Logic Imports for Assembly
import { generateFileTree } from '../fileTreeUtils.js';
import { generateSummary } from '../symbolGraph/summaryGenerator.js';
import { scanBoundaries } from '../symbolGraph/boundaryScanner/index.js';
import { generateBoundaryLibrary } from '../symbolGraph/typeDefinitionExtractor.js';

// Initialize Tokenizer (Singleton in Worker Scope)
const tokenizer = getEncoding('cl100k_base');

/**
 * Listens for tasks from the Main Thread.
 */
self.onmessage = async (event: MessageEvent<WorkerTask>) => {
  const { taskId, type, payload } = event.data;

  try {
    if (type === 'ANALYZE_FILE') {
      // Safe checks for payload existence
      if (!payload.path || payload.content === undefined) {
        throw new Error('Invalid payload for ANALYZE_FILE');
      }
      const result = analyzeFile(payload.path, payload.content);
      const response: WorkerResult = { taskId, payload: result };
      self.postMessage(response);

    } else if (type === 'ASSEMBLE_PACK') {
      if (!payload.assembly) {
        throw new Error('Invalid payload for ASSEMBLE_PACK');
      }
      const result = await assemblePack(payload.assembly);
      const response: WorkerResult = { taskId, assembly: result };
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
 */
function analyzeFile(path: string, content: string): DistilledMetadata {
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

  traverse(ast, {
    ImportDeclaration(p) {
      imports.push(p.node.source.value);
    },
    ExportNamedDeclaration(p) {
      if (p.node.source) {
        imports.push(p.node.source.value);
      }
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
    ExportAllDeclaration(p) {
      imports.push(p.node.source.value);
    },
    ExportDefaultDeclaration() {
      symbols.push('default');
    }
  });

  return {
    filePath: path,
    symbols: Array.from(new Set(symbols)),
    imports: Array.from(new Set(imports)),
    hasReexports: reexports,
    hasLogicActivity: logic,
    isBarrel: barrel
  };
}

/**
 * Orchestrates the full Context Pack assembly process off-thread.
 */
async function assemblePack(data: AssemblyPayload): Promise<AssemblyResult> {
  const { targets, files, options } = data;
  const pack: string[] = [];
  
  // 1. AST Cache for Boundary Scanning
  // We parse all targeted files. This is CPU heavy, hence why it's in the worker.
  const targetAsts = new Map<string, File>();
  
  // Also keep a lightweight "File Index" mock for the scanners to check existence
  const fileIndexMock = new Map<string, any>();
  Object.keys(files).forEach(path => {
    fileIndexMock.set(path, {
      path,
      // Minimal mock of FileEntry needed by extractors
      getText: async () => files[path]
    });
  });

  // --- LAYER 1: SPATIAL MAP ---
  const tree = generateFileTree(targets.map(t => t.path));
  pack.push('--- START OF CONTEXT PACK ---');
  pack.push('\n--- LAYER 1: SPATIAL MAP ---\n');
  pack.push(tree);

  const sourceLogicMarker = '\n--- LAYER 2: SOURCE LOGIC ---\n';
  pack.push(sourceLogicMarker);

  // --- LAYER 2: SOURCE LOGIC ---
  for (const target of targets) {
    const content = files[target.path];
    if (content === undefined) continue;

    if (target.resolution === 'full') {
      // Full Implementation
      pack.push(`=== ${target.path} ===`);
      pack.push(`[SEED - Full Implementation]`);
      pack.push('');
      pack.push(content);
      pack.push(`\n--- END OF FILE ---\n`);

      // Parse and cache AST for boundary scanning
      try {
        const ast = parser.parse(content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
          errorRecovery: true
        });
        targetAsts.set(target.path, ast);
      } catch (e) {
        // Ignore parse errors for boundary scanning candidates
      }

    } else {
      // Summary Brief
      try {
        const ast = parser.parse(content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx'],
          errorRecovery: true
        });
        const summary = generateSummary(target.path, ast, content);
        pack.push(summary);
        pack.push('\n');
      } catch {
        pack.push(`=== ${target.path} ===`);
        pack.push(`[SUMMARY - Parse Failure]`);
        pack.push(`// Content omitted due to syntax errors.\n`);
      }
    }
  }

  // --- LAYER 1.5: BOUNDARY LIBRARY ---
  if (options.includeBoundaryLibrary && targetAsts.size > 0) {
    // Scan for imports in our targets that point to files we HAVE content for 
    // but are NOT in the target list (i.e., boundaries passed by the main thread).
    
    // We assume the main thread has populated 'files' with boundary candidates.
    // The scanBoundaries logic will check 'fileIndexMock' for existence.
    const boundarySymbols = scanBoundaries(
      fileIndexMock as any, 
      targetAsts
    );

    if (boundarySymbols.length > 0) {
      const boundaryLibrary = await generateBoundaryLibrary(
        fileIndexMock as any, 
        boundarySymbols
      );
      
      if (boundaryLibrary) {
        // Inject before Layer 2
        const markerIndex = pack.indexOf(sourceLogicMarker);
        if (markerIndex !== -1) {
          pack.splice(markerIndex, 0, 
            '\n--- LAYER 1.5: BOUNDARY LIBRARY ---\n',
            boundaryLibrary,
            '\n'
          );
        }
      }
    }
  }

  pack.push('--- END OF PACK ---');
  
  const fullText = pack.join('\n');
  
  // --- TOKEN COUNTING (Accurate) ---
  const tokenCount = tokenizer.encode(fullText).length;

  return {
    fullText,
    tokenCount
  };
}