/**
 * @file packages/core/test/specs/06-output-formatting.spec.ts
 * @stamp {"ts":"2026-02-16T22:30:00Z"}
 * @architectural-role Test Suite
 * @description
 * Validates the Three-Layer Assembly engine. Verifies the generated string 
 * structure and ensures that the "Seed" and "Summary" markers are applied 
 * correctly. Updated to support the Pre-Computed Type Closure architecture 
 * by injecting semantic libraries into the assembly pipeline.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NetworkHarness } from '../harness/network-harness.js';
import { discoverContextPaths } from '../../src/components/hooks/useQueryPanelState/queryDiscoveryService.js';
import { runPreFlight } from '../../src/components/hooks/useTargetedPackManager/preFlightService.js';
import { assembleContextPack } from '../../src/components/hooks/useTargetedPackManager/packAssembler.js';
import type { QueryPanelState } from '../../src/components/hooks/useQueryPanelState/types.js';

describe('Context Pack Assembly & Formatting', () => {
  let harness: NetworkHarness;

  beforeAll(async () => {
    harness = await NetworkHarness.bootstrap();
  });

  /**
   * Helper to simulate a full generation flow from state to string.
   * Matches the updated signature of the pack assembler.
   */
  async function generateFullPack(state: Partial<QueryPanelState>) {
    const fileIndex = harness.getFileIndex();
    const graph = harness.getSymbolGraph();
    const typeLibrary = harness.getTypeLib();
    const signatureLibrary = harness.getSignLib();
    
    // 1. Discover Instructions
    const queryState = {
      traceQuery: null,
      traceDirection: 'dependencies' as const,
      traceDepth: 0,
      summaryTraceDepth: 0,
      traceMode: 'logical' as const,
      passiveOutputMode: 'meta' as const,
      wildcardQuery: '',
      exclusionWildcardQuery: '',
      isLoading: false,
      error: '',
      successMessage: '',
      resolutionWarnings: [],
      checkedDocsFolders: {},
      ...state
    };

    const { paths: instructions } = await discoverContextPaths(fileIndex, graph, queryState);
    
    // 2. Parse Instructions (DSL)
    const rawInput = instructions.join(', ');
    const targets = rawInput.split(', ').map(s => {
      if (s.endsWith(':summary')) return { path: s.replace(':summary', ''), resolution: 'summary' as const };
      return { path: s, resolution: 'full' as const };
    }).filter(t => t.path !== '');

    // 3. Pre-Flight (Load Content + AST)
    const preFlightData = await runPreFlight(targets, fileIndex);

    // 4. Assemble with Semantic Libraries
    return await assembleContextPack(
      fileIndex, 
      targets, 
      preFlightData, 
      typeLibrary,
      signatureLibrary,
      {
        docblocksOnly: false,
        includeBoundaryLibrary: true,
        aliasMap: {
          '@prism/shared-types': 'packages/shared-types',
          '@prism/ui-kit': 'packages/ui-kit',
          '@prism/web': 'packages/web'
        }
      }
    );
  }

  it('should produce a valid Three-Layer structure in the correct order', async () => {
    const pack = await generateFullPack({
      traceQuery: 'packages/web/App.tsx',
      traceDepth: 0,
      summaryTraceDepth: 1
    });

    const lines = pack.split('\n');

    const treeHeaderIdx = lines.findIndex(l => l.includes('LAYER 1: SPATIAL MAP'));
    const boundaryHeaderIdx = lines.findIndex(l => l.includes('LAYER 1.5: BOUNDARY LIBRARY'));
    const sourceHeaderIdx = lines.findIndex(l => l.includes('LAYER 2: SOURCE LOGIC'));

    expect(treeHeaderIdx).toBeGreaterThan(-1);
    expect(boundaryHeaderIdx).toBeGreaterThan(-1);
    expect(sourceHeaderIdx).toBeGreaterThan(-1);

    // Validate Order: Tree < Boundary < Source
    expect(treeHeaderIdx).toBeLessThan(boundaryHeaderIdx);
    expect(boundaryHeaderIdx).toBeLessThan(sourceHeaderIdx);
  });

  it('should include semantic boundary definitions for external dependencies', async () => {
    // adapter.ts imports LegacyUser from oldTypes.ts (not in selection)
    const pack = await generateFullPack({
      traceQuery: 'packages/web/adapter.ts',
      traceDepth: 0
    });

    expect(pack).toContain('--- LAYER 1.5: BOUNDARY LIBRARY ---');
    expect(pack).toContain('=== PROJECT BOUNDARY DEFINITIONS ===');
    
    // Semantic verification: Interface should be extracted from dictionary
    expect(pack).toContain('interface LegacyUser');
    expect(pack).toContain('oldId: number');
  });

  it('should apply implementation-omitted markers for value boundaries', async () => {
    // Entry2.tsx imports Dashboard component
    const pack = await generateFullPack({
      traceQuery: 'packages/web/Entry2.tsx',
      traceDepth: 0
    });

    expect(pack).toContain('--- LAYER 1.5: BOUNDARY LIBRARY ---');
    // Synthetic signature check
    expect(pack).toContain('export declare const Dashboard');
    // FIX: Updated to lowercase 'p' to match implementation in typeDefinitionExtractor.ts
    expect(pack).toContain('preserve architectural context');
  });

  it('should apply the [SEED] marker to Full Code and [SUMMARY] to distallations', async () => {
    const pack = await generateFullPack({
      traceQuery: 'packages/web/App.tsx',
      traceDepth: 0,
      summaryTraceDepth: 1
    });

    expect(pack).toContain('=== packages/web/App.tsx ===');
    expect(pack).toContain('[SEED - Full Implementation]');

    // ScentChainA is a hop 1 logic neighbor -> Summary
    expect(pack).toContain('=== packages/web/ScentChainA.ts ===');
    expect(pack).toContain('[SUMMARY - Dependency Brief]');
  });

  it('should generate an ASCII file tree wrapping the spatial map', async () => {
    const pack = await generateFullPack({
      wildcardQuery: 'packages/web/App.tsx, packages/web/TODO.ts'
    });

    expect(pack).toContain('```text');
    expect(pack).toContain('App.tsx');
    expect(pack).toContain('TODO.ts');
    expect(pack).toContain('```');
  });
});