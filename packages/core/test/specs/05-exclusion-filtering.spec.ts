/**
 * @file packages/core/test/specs/05-exclusion-filtering.spec.ts
 * @stamp {"ts":"2026-02-15T23:10:00Z"}
 * @architectural-role Test Suite
 * @test-target packages/core/src/components/hooks/useQueryPanelState/queryDiscoveryService.ts
 *
 * @description
 * Validates the exclusion filtering engine (The Sieve). Verifies that wildcard 
 * patterns correctly prune the discovery list and that the tracer maintains 
 * connectivity through excluded nodes (Trace-Through).
 * 
 * @criticality 2. Core Business Logic Orchestration.
 * @testing-layer Integration
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NetworkHarness } from '../harness/network-harness';
import { discoverContextPaths } from '../../src/components/hooks/useQueryPanelState/queryDiscoveryService';
import type { QueryPanelState } from '../../src/components/hooks/useQueryPanelState/types';

describe('Exclusion Filtering & Pattern Matching', () => {
  let harness: NetworkHarness;

  beforeAll(async () => {
    harness = await NetworkHarness.bootstrap();
  });

  /**
   * Helper to create a default query state for testing
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

  it('should exclude intermediate nodes while maintaining "Trace-Through" connectivity', async () => {
    const fileIndex = harness.getFileIndex();
    const graph = harness.getSymbolGraph();

    // SCENARIO: Trace-Through
    // Chain: ScentChainA -> ScentChainB -> ScentChainC
    // We want to exclude the middle node (ScentChainB) but still find the leaf (ScentChainC).
    // This proves the graph was traversed BEFORE the exclusion filter was applied.
    const state = createBaseState({
      traceQuery: 'packages/web/ScentChainA.ts',
      traceDepth: 5,
      exclusionWildcardQuery: '**/ScentChainB.ts'
    });

    const { paths } = await discoverContextPaths(fileIndex, graph, state);

    // 1. ScentChainC MUST be included (it was reached via ScentChainB during graph traversal)
    expect(paths.some(p => p.includes('packages/web/ScentChainC.ts'))).toBe(true);

    // 2. ScentChainA MUST be included (it is the seed)
    expect(paths.some(p => p.includes('packages/web/ScentChainA.ts'))).toBe(true);

    // 3. ScentChainB MUST be absent (it was caught in the exclusion sieve)
    expect(paths.some(p => p.includes('packages/web/ScentChainB.ts'))).toBe(false);
  });

  it('should exclude entire directories via recursive wildcards (legacy/**)', async () => {
    const fileIndex = harness.getFileIndex();
    const graph = harness.getSymbolGraph();

    // SCENARIO: 
    // We select everything in web via wildcard, but exclude the legacy folder.
    const state = createBaseState({
      wildcardQuery: 'packages/web/**/*',
      exclusionWildcardQuery: 'packages/legacy/**'
    });

    const { paths } = await discoverContextPaths(fileIndex, graph, state);

    // Should contain web files
    expect(paths.some(p => p.includes('packages/web/App.tsx'))).toBe(true);

    // Should NOT contain legacy files
    expect(paths.some(p => p.includes('packages/legacy/oldTypes.ts'))).toBe(false);
  });

  it('should apply exclusions to manually included Docs folders (Sieve Priority)', async () => {
    const fileIndex = harness.getFileIndex();
    const graph = harness.getSymbolGraph();

    // SCENARIO:
    // User checks 'docs' folder, but adds an exclusion pattern for yaml files.
    const state = createBaseState({
      checkedDocsFolders: { docs: true },
      exclusionWildcardQuery: '**/*.yaml'
    });

    const { paths } = await discoverContextPaths(fileIndex, graph, state);

    // Should contain markdown docs
    expect(paths.some(p => p.includes('decisions.md'))).toBe(true);

    // Should NOT contain yaml docs (the setup.yaml in web/docs/guides)
    expect(paths.some(p => p.includes('setup.yaml'))).toBe(false);
  });

  it('should support multiple comma-separated exclusion patterns', async () => {
    const fileIndex = harness.getFileIndex();
    const graph = harness.getSymbolGraph();

    const state = createBaseState({
      wildcardQuery: 'packages/web/**/*',
      exclusionWildcardQuery: '**/TODO.ts, **/data.json, **/config.yaml'
    });

    const { paths } = await discoverContextPaths(fileIndex, graph, state);

    // Verify multiple exclusions are respected
    expect(paths.some(p => p.includes('TODO.ts'))).toBe(false);
    expect(paths.some(p => p.includes('data.json'))).toBe(false);
    expect(paths.some(p => p.includes('config.yaml'))).toBe(false);
    
    // Verify valid files remain
    expect(paths.some(p => p.includes('App.tsx'))).toBe(true);
  });
});