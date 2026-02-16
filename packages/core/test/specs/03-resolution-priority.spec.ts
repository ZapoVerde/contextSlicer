/**
 * @file packages/core/test/specs/03-resolution-priority.spec.ts
 * @stamp {"ts":"2026-02-16T23:35:00Z"}
 * @architectural-role Test Suite
 * @test-target packages/core/src/components/hooks/useQueryPanelState/queryDiscoveryService.ts
 * @description
 * Validates the resolution assignment logic and conflict reconciliation rules.
 * Uses an in-memory Micro-Repo to ensure tests are independent of physical 
 * file structures. Updated to satisfy the DistilledMetadata interface requiring 
 * semantic registries and contract briefs.
 *
 * @criticality 2. Core Business Logic Orchestration.
 * @testing-layer Unit
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect, vi } from 'vitest';
import traverse from '@babel/traverse';
import { discoverContextPaths } from '../../src/components/hooks/useQueryPanelState/queryDiscoveryService.js';
import { buildSymbolGraph } from '../../src/logic/symbolGraph/index.js';
import { parseSourceToAst } from '../../src/logic/symbolGraph/passes/1_buildAstCache.js';
import { discoverSymbolsInAst } from '../../src/logic/symbolGraph/passes/2_discoverSymbols.js';
import type { QueryPanelState } from '../../src/components/hooks/useQueryPanelState/types.js';
import type { FileEntry } from '../../src/state/slicer-state.js';
import type { WorkerPool } from '../../src/logic/worker/WorkerPool.js';

// --- MOCK DATA ---

const MOCK_FILES = {
  'seed.ts': `import { dep } from './dependency'; export const seed = 1;`,
  'dependency.ts': `export const dep = 2;`,
  'other.ts': `export const other = 3;`
};

/**
 * Creates a minimal, in-memory project for testing logic rules.
 */
async function setupMicroRepo() {
  const fileIndex = new Map<string, FileEntry>();
  
  Object.entries(MOCK_FILES).forEach(([path, content]) => {
    fileIndex.set(path, {
      path,
      size: content.length,
      getText: async () => content,
      getUint8: async () => new TextEncoder().encode(content),
    });
  });

  // Mock WorkerPool for buildSymbolGraph orchestration
  const mockPool = {
    init: vi.fn(),
    execute: vi.fn(async (_type, payload) => {
      if (!payload.content) return { taskId: 'mock' };
      
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
        taskId: 'mock',
        payload: {
          filePath: payload.path,
          symbols: discoverSymbolsInAst(ast),
          imports: Array.from(new Set(imports)),
          hasReexports: false,
          hasLogicActivity: true,
          isBarrel: false,
          // Satisfy updated DistilledMetadata interface
          typeRegistry: {},
          syntheticSignatures: {},
          contractBrief: '\n--- STRUCTURAL CONTRACT ---\n'
        }
      };
    })
  } as unknown as WorkerPool;

  const graph = await buildSymbolGraph(fileIndex, {}, [], mockPool);
  
  return { fileIndex, graph };
}

/**
 * Factory for a default QueryPanelState.
 */
const createBaseState = (overrides: Partial<QueryPanelState>): QueryPanelState => ({
  traceQuery: null,
  traceDirection: 'dependencies',
  traceDepth: 0,
  summaryTraceDepth: 0,
  traceMode: 'logical',
  passiveOutputMode: 'meta',
  wildcardQuery: '',
  exclusionWildcardQuery: '',
  isLoading: false,
  error: '',
  successMessage: '',
  resolutionWarnings: [],
  checkedDocsFolders: {},
  ...overrides
});

// --- TESTS ---

describe('Logic: Resolution Priority & Reconciliation', () => {
  
  it('should prioritize Seed (Full) over Trace (Summary) for the same file', async () => {
    const { fileIndex, graph } = await setupMicroRepo();

    const state = createBaseState({
      wildcardQuery: 'dependency.ts',
      traceQuery: 'seed.ts',
      traceDepth: 0,
      summaryTraceDepth: 1
    });

    const { paths, resolutionWarnings } = await discoverContextPaths(fileIndex, graph, state);

    expect(paths).toContain('dependency.ts');
    expect(paths).not.toContain('dependency.ts:summary');
    expect(resolutionWarnings.some(w => w.includes('dependency.ts'))).toBe(true);
  });

  it('should assign :summary suffix when a file is only reached via Summary-zone trace', async () => {
    const { fileIndex, graph } = await setupMicroRepo();

    const state = createBaseState({
      traceQuery: 'seed.ts',
      traceDepth: 0,
      summaryTraceDepth: 1
    });

    const { paths } = await discoverContextPaths(fileIndex, graph, state);

    expect(paths).toContain('dependency.ts:summary');
  });

  it('should ignore Summary traces if the file is already in the Full-zone trace', async () => {
    const { fileIndex, graph } = await setupMicroRepo();

    const state = createBaseState({
      traceQuery: 'seed.ts',
      traceDepth: 1,
      summaryTraceDepth: 2
    });

    const { paths } = await discoverContextPaths(fileIndex, graph, state);

    expect(paths).toContain('dependency.ts');
    expect(paths).not.toContain('dependency.ts:summary');
  });

  it('should strictly exclude files regardless of resolution requested', async () => {
    const { fileIndex, graph } = await setupMicroRepo();

    const state = createBaseState({
      wildcardQuery: 'dependency.ts',
      exclusionWildcardQuery: 'dependency.ts'
    });

    const { paths } = await discoverContextPaths(fileIndex, graph, state);

    expect(paths).not.toContain('dependency.ts');
    expect(paths).not.toContain('dependency.ts:summary');
  });
});