/**
 * @file packages/core/test/harness/network-harness.ts
 * @stamp {"ts":"2026-02-16T21:10:00Z"}
 * @architectural-role Utility / Test Infrastructure
 * @description
 * The authoritative test harness for the Hardened Prism Network. Updated to 
 * support the Pre-Computed Type Closure architecture. The MockWorkerPool 
 * now simulates the semantic mining phase, extracting type registries and 
 * synthetic signatures from the test network files.
 * 
 * @core-principles
 * 1. TESTABILITY: MUST provide a synchronous simulation of worker threads.
 * 2. CONSISTENCY: Uses the same analysis logic as the production worker.
 * 3. COMPLIANCE: Matches the updated DistilledMetadata messaging protocol.
 * 
 * @api-declaration
 *   export class NetworkHarness { ... }
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
        if (!/\.(ts|tsx|js|jsx)$/.test(payload.path)) {
           return { taskId: 'mock-task' };
        }

        const ast = parseSourceToAst(payload.content);
        const imports: string[] = [];
        const typeRegistry: Record<string, string> = {};
        const syntheticSignatures: Record<string, string> = {};

        traverse(ast, {
          ImportDeclaration(p) {
            imports.push(p.node.source.value);
          },
          ExportNamedDeclaration(p) {
            if (p.node.source) imports.push(p.node.source.value);
            
            const decl = p.node.declaration;
            if (!decl) return;

            // Extract Type Registry
            if (
              decl.type === 'TSInterfaceDeclaration' ||
              decl.type === 'TSTypeAliasDeclaration' ||
              decl.type === 'TSEnumDeclaration'
            ) {
              if (decl.id?.type === 'Identifier') {
                const name = decl.id.name;
                if (decl.start !== null && decl.end !== null) {
                  typeRegistry[name] = payload.content.slice(decl.start, decl.end);
                }
              }
            }
            // Generate Synthetic Signatures for Values
            else if (decl.type === 'VariableDeclaration') {
              decl.declarations.forEach((d) => {
                if (d.id.type === 'Identifier') {
                  const name = d.id.name;
                  syntheticSignatures[name] = `export declare const ${name}: any;`;
                }
              });
            }
            else if (decl.type === 'FunctionDeclaration') {
              if (decl.id?.type === 'Identifier') {
                const name = decl.id.name;
                syntheticSignatures[name] = `export declare function ${name}(...args: any[]): any;`;
              }
            }
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
            typeRegistry,
            syntheticSignatures
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
  private typeLib: Map<string, Record<string, string>> = new Map();
  private signLib: Map<string, Record<string, string>> = new Map();
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
    if (!fs.existsSync(this.networkPath)) throw new Error('Test network not found');
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
    
    // Manual pass to build registries since buildSymbolGraph only returns the graph
    for (const file of this.fileIndex.values()) {
      if (!/\.(ts|tsx|js|jsx)$/.test(file.path)) continue;
      const res = await mockPool.execute('ANALYZE_FILE', { path: file.path, content: await file.getText() });
      if (res.payload) {
        this.typeLib.set(file.path, res.payload.typeRegistry);
        this.signLib.set(file.path, res.payload.syntheticSignatures);
      }
    }

    this.symbolGraph = await buildSymbolGraph(this.fileIndex, aliasMap, errors, mockPool);
  }

  public getFileIndex(): Map<string, FileEntry> { return this.fileIndex; }
  public getSymbolGraph(): SymbolGraph { return this.symbolGraph!; }
  public getTypeLib() { return this.typeLib; }
  public getSignLib() { return this.signLib; }

  public getAst(filePath: string): any {
    const entry = this.fileIndex.get(filePath);
    if (!entry || !/\.(ts|tsx|js|jsx)$/.test(filePath)) return null;
    const content = fs.readFileSync(path.join(this.networkPath, filePath), 'utf-8');
    try { return parseSourceToAst(content); } catch { return null; }
  }
}