/**
 * @file packages/core/test/harness/network-harness.ts
 * @stamp {"ts":"2026-02-15T23:15:00Z"}
 * @architectural-role Utility
 * @description
 * The authoritative test harness for the Hardened Prism Network v2.1.
 * Bridges the gap between the physical test fixture and the internal 
 * logical engines by simulating the FileIndex and orchestrating the 
 * Symbol Graph construction.
 * 
 * @api-declaration
 *   export class NetworkHarness {
 *     static async bootstrap(): Promise<NetworkHarness>;
 *     public getFileIndex(): Map<string, FileEntry>;
 *     public getSymbolGraph(): SymbolGraph;
 *     public getAst(path: string): File | null;
 *   }
 * 
 * @contract
 *   assertions:
 *     purity: mutates # Orchestrates setup and indexing.
 *     state_ownership: [fileIndex, symbolGraph, astCache]
 *     external_io: fs
 */

import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import type { File } from '@babel/types';
import { buildSymbolGraph } from '../../src/logic/symbolGraph';
import type { SymbolGraph } from '../../src/logic/symbolGraph/types';
import type { FileEntry } from '../../src/state/slicer-state';

/**
 * @id packages/core/test/harness/network-harness.ts#NetworkHarness
 * @description
 * Coordinates the loading of the test network into memory and the 
 * initialization of core architectural logic (Graphing/Parsing).
 */
export class NetworkHarness {
  private readonly fileIndex: Map<string, FileEntry> = new Map();
  private readonly astCache: Map<string, File> = new Map();
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

          // Eagerly parse scripts for the AST cache
          if (/\.(ts|tsx|js|jsx)$/.test(relPath)) {
            try {
              const ast = parse(content.toString('utf-8'), {
                sourceType: 'module',
                plugins: ['typescript', 'jsx'],
              });
              this.astCache.set(relPath, ast);
            } catch (e) {
              // Intentionally malformed files or Babel-incompatible syntax
            }
          }
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
   * Injects monorepo aliases to ensure cross-package resolution works correctly.
   */
  private async buildGraph(): Promise<void> {
    const errors: string[] = [];
    const aliasMap = {
      '@prism/shared-types': 'packages/shared-types',
      '@prism/ui-kit': 'packages/ui-kit',
      '@prism/web': 'packages/web'
    };

    this.symbolGraph = await buildSymbolGraph(this.fileIndex, aliasMap, errors);

    // CRITICAL DIAGNOSTIC: 
    // If the graph contains resolution errors (like unresolvable relative imports),
    // we must report them loudly to the test runner to prevent "Ghost Dependencies."
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

  public getAst(filePath: string): File | null {
    return this.astCache.get(filePath) || null;
  }

  public getAstCache(): Map<string, File> {
    return this.astCache;
  }
}