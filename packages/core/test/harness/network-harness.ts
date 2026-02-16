/**
 * @file packages/core/test/harness/network-harness.ts
 * @stamp {"ts":"2026-02-16T23:55:00Z"}
 * @architectural-role Utility / Test Infrastructure
 * @description
 * The authoritative test harness for the Hardened Prism Network. Bridges the 
 * gap between physical test fixtures and logical engines. Implements a 
 * MockWorkerPool to allow the multi-threaded build logic to execute within 
 * the Node.js test environment. Updated with safe, extension-aware parsing.
 * 
 * @core-principles
 * 1. TESTABILITY: MUST provide a synchronous simulation of worker threads.
 * 2. ROBUSTNESS: MUST NOT attempt to parse non-code files as ASTs.
 * 3. CONSISTENCY: Uses the same analysis logic as the production worker.
 * 
 * @api-declaration
 *   export class NetworkHarness { ... }
 * 
 * @contract
 *   assertions:
 *     purity: mutates # Orchestrates setup and indexing.
 *     state_ownership: [fileIndex, symbolGraph]
 *     external_io: fs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import traverse from '@babel/traverse';
import { buildSymbolGraph } from '../../src/logic/symbolGraph/index.js';
import { discoverSymbolsInAst } from '../../src/logic/symbolGraph/passes/2_discoverSymbols.js';
import { parseSourceToAst } from '../../src/logic/symbolGraph/passes/1_buildAstCache.js';
import { hasReexports, isBarrelFile } from '../../src/logic/symbolGraph/analyzers/barrelDetector.js';
import { hasLogicActivity } from '../../src/logic/symbolGraph/analyzers/flowAnalyzer.js';
import type { SymbolGraph } from '../../src/logic/symbolGraph/types.js';
import type { FileEntry } from '../../src/state/slicer-state.js';
import type { WorkerPool } from '../../src/logic/worker/WorkerPool.js';
import type { WorkerResult, TaskType } from '../../src/logic/worker/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * A specialized simulation of the WorkerPool for Node.js testing.
 * Instead of spawning threads, it executes the analysis logic 
 * sequentially in the main process.
 */
class MockWorkerPool {
  public async init(): Promise<void> {
    return Promise.resolve();
  }

  public async execute(
    type: TaskType,
    payload: { path: string; content: string }
  ): Promise<WorkerResult> {
    if (type === 'ANALYZE_FILE') {
      try {
        // Fix: Extension check to ensure the worker only parses scripts
        if (!/\.(ts|tsx|js|jsx)$/.test(payload.path)) {
           return { taskId: 'mock-task' };
        }

        const ast = parseSourceToAst(payload.content);
        const imports: string[] = [];

        traverse(ast, {
          ImportDeclaration(p) {
            imports.push(p.node.source.value);
          },
          ExportNamedDeclaration(p) {
            if (p.node.source) imports.push(p.node.source.value);
          },
          ExportAllDeclaration(p) {
            imports.push(p.node.source.value);
          }
        });

        return {
          taskId: 'mock-task',
          payload: {
            filePath: payload.path,
            symbols: discoverSymbolsInAst(ast),
            imports: Array.from(new Set(imports)),
            hasReexports: hasReexports(ast),
            hasLogicActivity: hasLogicActivity(ast),
            isBarrel: isBarrelFile(ast),
          },
        };
      } catch (e) {
        return {
          taskId: 'mock-task',
          error: e instanceof Error ? e.message : 'Mock Analysis Failed',
        };
      }
    }
    return { taskId: 'mock-task' };
  }
}

/**
 * @id packages/core/test/harness/network-harness.ts#NetworkHarness
 * @description
 * Coordinates the loading of the test network into memory and the 
 * initialization of core architectural logic.
 */
export class NetworkHarness {
  private readonly fileIndex: Map<string, FileEntry> = new Map();
  private symbolGraph: SymbolGraph | null = null;
  private readonly networkPath: string;

  private constructor() {
    this.networkPath = path.resolve(__dirname, '../../testnetwork');
  }

  public static async bootstrap(): Promise<NetworkHarness> {
    const harness = new NetworkHarness();
    await harness.initializeFileIndex();
    await harness.buildGraph();
    return harness;
  }

  private async initializeFileIndex(): Promise<void> {
    const walk = (dir: string) => {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const relPath = path.relative(this.networkPath, fullPath).replace(/\\/g, '/');
        
        if (fs.statSync(fullPath).isDirectory()) {
          walk(fullPath);
        } else {
          const content = fs.readFileSync(fullPath);
          const entry: FileEntry = {
            path: relPath,
            size: content.length,
            getText: async () => content.toString('utf-8'),
            getUint8: async () => new Uint8Array(content),
          };
          this.fileIndex.set(relPath, entry);
        }
      }
    };

    if (!fs.existsSync(this.networkPath)) {
      throw new Error(`Test network not found at: ${this.networkPath}. Run setup-network.cjs first.`);
    }

    walk(this.networkPath);
  }

  private async buildGraph(): Promise<void> {
    const errors: string[] = [];
    const aliasMap = {
      '@prism/shared-types': 'packages/shared-types',
      '@prism/ui-kit': 'packages/ui-kit',
      '@prism/web': 'packages/web'
    };

    const mockPool = new MockWorkerPool() as unknown as WorkerPool;
    this.symbolGraph = await buildSymbolGraph(this.fileIndex, aliasMap, errors, mockPool);

    if (errors.length > 0) {
      console.error('\n' + '='.repeat(60));
      console.error('[Harness] Graph build completed with resolution errors:');
      errors.forEach(e => console.error(`  - ${e}`));
      console.error('='.repeat(60) + '\n');
    }
  }

  public getFileIndex(): Map<string, FileEntry> {
    return this.fileIndex;
  }

  public getSymbolGraph(): SymbolGraph {
    if (!this.symbolGraph) throw new Error('Graph not initialized');
    return this.symbolGraph;
  }

  /**
   * Safe AST retrieval. Only parses supported script extensions.
   */
  public getAst(filePath: string): any {
    const entry = this.fileIndex.get(filePath);
    if (!entry) return null;
    
    // Safety check: Only parse if it's a code file
    if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) {
      return null;
    }

    const content = fs.readFileSync(path.join(this.networkPath, filePath), 'utf-8');
    try {
      return parseSourceToAst(content);
    } catch {
      return null;
    }
  }
}