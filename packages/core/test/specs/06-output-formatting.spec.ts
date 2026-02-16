/**
 * @file packages/core/test/specs/06-output-formatting.spec.ts
 * @stamp {"ts":"2026-02-15T23:10:00Z"}
 * @architectural-role Test Suite
 * @description
 * Validates the Three-Layer Assembly engine. Verifies the generated string 
 * structure (Tree, Boundary Library, Source Logic) and ensures that the 
 * "Seed" and "Summary" markers are applied correctly based on the resolution gradient.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NetworkHarness } from '../harness/network-harness';
import { discoverContextPaths } from '../../src/components/hooks/useQueryPanelState/queryDiscoveryService';
import { runPreFlight } from '../../src/components/hooks/useTargetedPackManager/preFlightService';
import { assembleContextPack } from '../../src/components/hooks/useTargetedPackManager/packAssembler';
import { useTargetParsing } from '../../src/components/hooks/useTargetedPackManager/useTargetParsing';
import type { QueryPanelState } from '../../src/components/hooks/useQueryPanelState/types';

describe('Context Pack Assembly & Formatting', () => {
  let harness: NetworkHarness;

  beforeAll(async () => {
    harness = await NetworkHarness.bootstrap();
  });

  /**
   * Helper to simulate a full generation flow from state to string
   */
  async function generateFullPack(state: Partial<QueryPanelState>) {
    const fileIndex = harness.getFileIndex();
    const graph = harness.getSymbolGraph();
    
    // 1. Discover Instructions (e.g. ["file.ts", "dep.ts:summary"])
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
    
    // 2. Parse Instructions (The DSL parsing)
    // We use a manual join/parse because the hook is usually React-bound
    const rawInput = instructions.join(', ');
    const targets = rawInput.split(', ').map(s => {
      if (s.endsWith(':summary')) return { path: s.replace(':summary', ''), resolution: 'summary' as const };
      return { path: s, resolution: 'full' as const };
    }).filter(t => t.path !== '');

    // 3. Pre-Flight (Load + AST)
    const preFlightData = await runPreFlight(targets, fileIndex);

    // 4. Assemble
    return await assembleContextPack(fileIndex, targets, preFlightData, {
      docblocksOnly: false,
      includeBoundaryLibrary: true
    });
  }

  it('should produce a valid Three-Layer structure in the correct order', async () => {
    const pack = await generateFullPack({
      traceQuery: 'packages/web/App.tsx',
      traceDepth: 0,
      summaryTraceDepth: 1
    });

    const lines = pack.split('\n');

    // Layer 1: Spatial Map
    const treeHeaderIdx = lines.findIndex(l => l.includes('LAYER 1: SPATIAL MAP'));
    // Layer 1.5: Boundary Library
    const boundaryHeaderIdx = lines.findIndex(l => l.includes('LAYER 1.5: BOUNDARY LIBRARY'));
    // Layer 2: Source Logic
    const sourceHeaderIdx = lines.findIndex(l => l.includes('LAYER 2: SOURCE LOGIC'));

    expect(treeHeaderIdx).toBeGreaterThan(-1);
    expect(boundaryHeaderIdx).toBeGreaterThan(-1);
    expect(sourceHeaderIdx).toBeGreaterThan(-1);

    // Validate Order: Tree < Boundary < Source
    expect(treeHeaderIdx).toBeLessThan(boundaryHeaderIdx);
    expect(boundaryHeaderIdx).toBeLessThan(sourceHeaderIdx);
  });

  it('should apply the [SEED] marker to Full Code and [SUMMARY] to distallations', async () => {
    const pack = await generateFullPack({
      traceQuery: 'packages/web/App.tsx',
      traceDepth: 0, // App is seed (Full), others summary
      summaryTraceDepth: 1
    });

    // App.tsx is the seed
    expect(pack).toContain('=== packages/web/App.tsx ===');
    expect(pack).toContain('[SEED - Full Implementation]');

    // ScentChainA.ts is a dependency at hop 1 -> Summary
    expect(pack).toContain('=== packages/web/ScentChainA.ts ===');
    expect(pack).toContain('[SUMMARY - Dependency Brief]');
    
    // Summary Brief should contain the flow pattern
    expect(pack).toContain('[TRANSFORM] → ScentChainA');
  });

  it('should include imported types in the Boundary Library for excluded symbols', async () => {
    const pack = await generateFullPack({
      traceQuery: 'packages/web/adapter.ts', // Seeds with adapter
      traceDepth: 0
    });

    // adapter.ts imports LegacyUser from legacy/oldTypes.ts (not in selection)
    expect(pack).toContain('--- LAYER 1.5: BOUNDARY LIBRARY ---');
    expect(pack).toContain('=== PROJECT BOUNDARY DEFINITIONS ===');
    expect(pack).toContain('interface LegacyUser');
  });

  it('should generate an ASCII file tree containing all selected paths', async () => {
    const pack = await generateFullPack({
      wildcardQuery: 'packages/web/App.tsx, packages/web/TODO.ts'
    });

    const treeBlock = pack.split('```text')[1].split('```')[0];
    
    expect(treeBlock).toContain('App.tsx');
    expect(treeBlock).toContain('TODO.ts');
    expect(treeBlock).toContain('└──');
  });

  it('should correctly reconcile conflicts by prioritizing Seed (Full) markers', async () => {
    // config.ts requested as Full (wildcard) and Summary (trace)
    const pack = await generateFullPack({
      wildcardQuery: 'packages/shared-types/config.ts',
      traceQuery: 'packages/web/App.tsx',
      summaryTraceDepth: 5
    });

    // config.ts should have the SEED marker because Full won the reconciliation
    expect(pack).toContain('=== packages/shared-types/config.ts ===');
    expect(pack).toContain('[SEED - Full Implementation]');
    expect(pack).not.toContain('config.ts ===\n[SUMMARY');
  });
});