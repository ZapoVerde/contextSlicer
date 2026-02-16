/**
 * @file packages/core/test/harness/network-harness.ts
 * @stamp {"ts":"2026-02-16T23:15:00Z"}
 * @architectural-role Utility / Test Infrastructure
 * @description
 * The authoritative test harness for the Hardened Prism Network. Updated to 
 * utilize the production data pipeline. It mocks the WorkerPool to perform 
 * synchronous AST analysis, then feeds those results through the `buildSymbolGraph` 
 * orchestrator to populate the test harness's semantic libraries.
 * 
 * @core-principles
 * 1. TESTABILITY: MUST provide a synchronous simulation of worker threads.
 * 2. INTEGRITY: Validates the actual `buildSymbolGraph` pipeline return values.
 * 3. COMPLIANCE: Matches the DistilledMetadata protocol for all semantic registries.
 * 
 * @api-declaration
 *   export class NetworkHarness { ... }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import traverse from '@babel/traverse';
import type { Identifier } from '@babel/types';
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
 * Formats captured import and export data into a clean text block.
 * Mirrors the logic in production fileAnalyzer.ts.
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
        
        const importSummary = new Map<string, string[]>();
        const exportSummary: string[] = [];

        traverse(ast, {
          ImportDeclaration(p) {
            const source = p.node.source.value;
            imports.push(source);
            const names = p.node.specifiers.map(spec => {
              if (spec.type === 'ImportSpecifier') return (spec.imported as Identifier).name;
              return spec.type === 'ImportDefaultSpecifier' ? 'default' : '*';
            });
            importSummary.set(source, [...(importSummary.get(source) || []), ...names]);
          },
          ExportNamedDeclaration(p) {
            if (p.node.source) {
              imports.push(p.node.source.value);
              const names = p.node.specifiers.map(s => (s.exported as Identifier).name);
              importSummary.set(p.node.source.value, [...(importSummary.get(p.node.source.value) || []), ...names]);
            }
            
            const decl = p.node.declaration;
            if (!decl) {
              p.node.specifiers.forEach(s => {
                const name = (s.exported as Identifier).name;
                exportSummary.push(name);
              });
              return;
            }

            // Extract Types
            if (['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSEnumDeclaration'].includes(decl.type)) {
              const name = (decl as any).id.name;
              exportSummary.push(`${name} (Type)`);
              if (decl.start !== null && decl.end !== null) {
                typeRegistry[name] = payload.content.slice(decl.start, decl.end);
              }
            } 
            // Extract Variables
            else if (decl.type === 'VariableDeclaration') {
              decl.declarations.forEach(d => {
                const name = (d.id as Identifier).name;
                exportSummary.push(`${name} (Variable)`);
                syntheticSignatures[name] = `export declare const ${name}: any;`;
              });
            } 
            // Extract Functions
            else if (decl.type === 'FunctionDeclaration' && decl.id) {
              exportSummary.push(`${decl.id.name} (Function)`);
              syntheticSignatures[decl.id.name] = `export declare function ${decl.id.name}(...args: any[]): any;`;
            }
          },
          ExportDefaultDeclaration() {
            exportSummary.push('default');
          },
          ExportAllDeclaration(p) {
            imports.push(p.node.source.value);
            importSummary.set(p.node.source.value, [...(importSummary.get(p.node.source.value) || []), '*']);
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
            syntheticSignatures,
            contractBrief: formatContractBrief(importSummary, exportSummary)
          },
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