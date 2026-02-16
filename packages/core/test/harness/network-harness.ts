/**
 * @file packages/core/test/harness/network-harness.ts
 * @stamp {"ts":"2026-02-16T18:30:00Z"}
 * @architectural-role Utility / Test Infrastructure
 * @description
 * The authoritative test harness for the Hardened Prism Network. Bridges the 
 * gap between physical test fixtures and logical engines. Implements a 
 * MockWorkerPool to allow the multi-threaded build logic to execute within 
 * the Node.js test environment.
 * 
 * @core-principles
 * 1. TESTABILITY: MUST provide a synchronous simulation of worker threads.
 * 2. ISOLATION: Ensures tests do not depend on browser-specific APIs (Web Workers).
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
import { buildSymbolGraph } from '../../src/logic/symbolGraph/index.js';
import { discoverSymbolsInAst } from '../../src/logic/symbolGraph/passes/2_discoverSymbols.js';
import { parseSourceToAst } from '../../src/logic/symbolGraph/passes/1_buildAstCache.js';
import { hasReexports, isBarrelFile } from '../../src/logic/symbolGraph/analyzers/barrelDetector.js';
import { hasLogicActivity } from '../../src/logic/symbolGraph/analyzers/flowAnalyzer.js';
import type { SymbolGraph } from '../../src/logic/symbolGraph/types.js';
import type { FileEntry } from '../../src/state/slicer-state.js';
import type { WorkerPool } from '../../src/logic/worker/WorkerPool.js';
import type { WorkerResult, TaskType } from '../../src/logic/worker/types.js';

// Resolve __dirname in ESM
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
        const ast = parseSourceToAst(payload.content);
        return {
          taskId: 'mock-task',
          payload: {
            filePath: payload.path,
            symbols: discoverSymbolsInAst(ast),
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
    // Resolve path to the testnetwork directory relative to this harness
    this.networkPath = path.resolve(__dirname, '../../testnetwork');
  }

  /**
   * Initializes the harness by scanning the physical network and building the graph.
   */
  public static async bootstrap(): Promise<NetworkHarness> {
    const harness = new NetworkHarness();
    await harness.initializeFileIndex();
    await harness.buildGraph();
    return harness;
  }

  /**
   * Recursively scans the testnetwork directory to populate the in-memory FileIndex.
   */
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

  /**
   * Orchestrates the build of the Symbol Graph using the provided FileIndex.
   * Injects monorepo aliases and the Mock Worker Pool.
   */
  private async buildGraph(): Promise<void> {
    const errors: string[] = [];
    const aliasMap = {
      '@prism/shared-types': 'packages/shared-types',
      '@prism/ui-kit': 'packages/ui-kit',
      '@prism/web': 'packages/web'
    };

    // Cast MockWorkerPool to WorkerPool to satisfy the interface requirement
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

  public getAst(filePath: string): any {
    const entry = this.fileIndex.get(filePath);
    if (!entry) return null;
    
    // Synchronous read for testing convenience
    const content = fs.readFileSync(path.join(this.networkPath, filePath), 'utf-8');
    return parseSourceToAst(content);
  }
}