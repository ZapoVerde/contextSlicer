/**
 * @file packages/core/test/harness/network-harness.ts
 * @stamp {"ts":"2026-02-17T00:15:00Z"}
 * @architectural-role Utility / Test Infrastructure
 * @description
 * The authoritative test harness for the Hardened Prism Network. Updated to 
 * utilize the production data pipeline directly via `analyzeFile`, ensuring 
 * 1:1 parity between test mock execution and production worker behavior.
 * 
 * @core-principles
 * 1. TESTABILITY: MUST provide a synchronous simulation of worker threads.
 * 2. INTEGRITY: Uses actual production logic (`analyzeFile`) to prevent mock drift.
 * 3. COMPLIANCE: Matches the DistilledMetadata protocol for all semantic registries.
 * 
 * @api-declaration
 *   export class NetworkHarness { ... }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseSourceToAst } from '../../src/logic/symbolGraph/passes/1_buildAstCache.js';
import { buildSymbolGraph } from '../../src/logic/symbolGraph/index.js';
import type { SymbolGraph } from '../../src/logic/symbolGraph/types.js';
import type { FileEntry } from '../../src/state/slicer-state.js';
import type { WorkerPool } from '../../src/logic/worker/WorkerPool.js';
import type { WorkerResult, TaskType } from '../../src/logic/worker/types.js';

// CRITICAL FIX: Use the actual production analyzer to ensure tests match reality
import { analyzeFile } from '../../src/logic/worker/fileAnalyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * A specialized simulation of the WorkerPool for Node.js testing.
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
        if (!payload.path || payload.content === undefined) {
           return { taskId: 'mock-task', error: 'Invalid payload' };
        }

        // Only analyze supported file types, mirroring production behavior
        if (!/\.(ts|tsx|js|jsx)$/.test(payload.path)) {
           return { taskId: 'mock-task' };
        }

        // Execute the REAL production logic
        const metadata = analyzeFile(payload.path, payload.content);

        return {
          taskId: 'mock-task',
          payload: metadata,
        };
      } catch (e) {
        return { taskId: 'mock-task', error: e instanceof Error ? e.message : 'Mock Analysis Failed' };
      }
    }
    return { taskId: 'mock-task' };
  }
}

/**
 * Coordinates the loading of the test network into memory.
 */
export class NetworkHarness {
  private readonly fileIndex: Map<string, FileEntry> = new Map();
  private symbolGraph: SymbolGraph | null = null;
  
  // Semantic Libraries
  private typeLib: Map<string, Record<string, string>> = new Map();
  private signLib: Map<string, Record<string, string>> = new Map();
  private contractLib: Map<string, string> = new Map();
  
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
          this.fileIndex.set(relPath, {
            path: relPath,
            size: content.length,
            getText: async () => content.toString('utf-8'),
            getUint8: async () => new Uint8Array(content),
          });
        }
      }
    };
    if (!fs.existsSync(this.networkPath)) throw new Error('Test network not found');
    walk(this.networkPath);
  }

  private async buildGraph(): Promise<void> {
    const mockPool = new MockWorkerPool() as unknown as WorkerPool;
    const errors: string[] = [];
    const aliasMap = {
      '@prism/shared-types': 'packages/shared-types',
      '@prism/ui-kit': 'packages/ui-kit',
      '@prism/web': 'packages/web'
    };

    // Execute the production orchestrator
    // This tests that buildSymbolGraph correctly aggregates worker results
    const { graph, results } = await buildSymbolGraph(this.fileIndex, aliasMap, errors, mockPool);
    this.symbolGraph = graph;

    // Populate local libraries from the returned results
    // This mirrors the logic in the main-thread registry.ts
    results.forEach(res => {
      if (res.payload) {
        this.typeLib.set(res.payload.filePath, res.payload.typeRegistry);
        this.signLib.set(res.payload.filePath, res.payload.syntheticSignatures);
        this.contractLib.set(res.payload.filePath, res.payload.contractBrief);
      }
    });
  }

  public getFileIndex(): Map<string, FileEntry> { return this.fileIndex; }
  public getSymbolGraph(): SymbolGraph { return this.symbolGraph!; }
  public getTypeLib() { return this.typeLib; }
  public getSignLib() { return this.signLib; }
  public getContractLib() { return this.contractLib; }

  public getAst(filePath: string): any {
    const entry = this.fileIndex.get(filePath);
    if (!entry || !/\.(ts|tsx|js|jsx)$/.test(filePath)) return null;
    const content = fs.readFileSync(path.join(this.networkPath, filePath), 'utf-8');
    try { return parseSourceToAst(content); } catch { return null; }
  }
}