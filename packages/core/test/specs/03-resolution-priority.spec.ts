/**
 * @file packages/core/test/specs/03-resolution-priority.spec.ts
 * @stamp {"ts":"2026-02-15T21:30:00Z"}
 * @architectural-role Test Suite
 * @description
 * Validates the resolution assignment logic and conflict reconciliation.
 * Verifies that the system correctly distinguishes between Full and Summary 
 * extraction zones based on logical hops and enforces the "Highest Resolution Wins" 
 * rule for overlapping selections.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NetworkHarness } from '../harness/network-harness';
import { traceLogicalPath } from '../../src/logic/symbolGraph/augmentedTracer';
import { discoverContextPaths } from '../../src/components/hooks/useQueryPanelState/queryDiscoveryService';
import type { QueryPanelState } from '../../src/components/hooks/useQueryPanelState/types';

describe('Resolution Priority & Reconciliation', () => {
  let harness: NetworkHarness;

  beforeAll(async () => {
    harness = await NetworkHarness.bootstrap();
  });

  describe('Gradient Assignment (Tracer Logic)', () => {
    it('should assign Full to Logic at Hop 1 and Summary to Logic at Hop 2', () => {
      const graph = harness.getSymbolGraph();
      const astCache = harness.getAstCache();
      const seed = 'packages/web/App.tsx';

      // Trace: App -> ScentChainA (Logic, 1) -> ScentChainB (Logic, 2)
      const results = traceLogicalPath(graph, astCache, seed, {
        mode: 'logical',
        direction: 'dependencies',
        maxHops: 1,      // Full limit
        summaryHops: 2   // Summary limit
      });

      const chainA = results.find(r => r.path === 'packages/web/ScentChainA.ts');
      const chainB = results.find(r => r.path === 'packages/web/ScentChainB.ts');

      expect(chainA?.resolution).toBe('full');
      expect(chainB?.resolution).toBe('summary');
    });

    it('should force Summary for Pipe files even if they are within the Full hop range', () => {
      const graph = harness.getSymbolGraph();
      const astCache = harness.getAstCache();
      const seed = 'packages/web/App.tsx';
      const pipePath = 'packages/ui-kit/components/index.ts';

      // App -> ComplexBarrel (Pipe) -> components/index.ts (Pipe)
      // Both are within 1 logical hop (0 cost).
      const results = traceLogicalPath(graph, astCache, seed, {
        mode: 'logical',
        direction: 'dependencies',
        maxHops: 5,
        summaryHops: 5
      });

      const pipe = results.find(r => r.path === pipePath);
      expect(pipe?.status).toBe('passive');
      expect(pipe?.resolution).toBe('summary');
    });
  });

  describe('Reconciliation (Discovery Service Logic)', () => {
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

    it('should resolve conflicts using "Highest Resolution Wins" (Full > Summary)', async () => {
      const fileIndex = harness.getFileIndex();
      const graph = harness.getSymbolGraph();

      // Scenario:
      // 1. config.ts is requested as a Seed (Full) via wildcard.
      // 2. config.ts is also reached via trace at depth 3 (Summary).
      const state = createBaseState({
        wildcardQuery: 'packages/shared-types/config.ts',
        traceQuery: 'packages/web/App.tsx',
        traceDepth: 1,
        summaryTraceDepth: 5 // Trace will reach config.ts as summary
      });

      const { paths, resolutionWarnings } = await discoverContextPaths(fileIndex, graph, state);

      // Check for config.ts in results
      const configInstruction = paths.find(p => p.includes('config.ts'));
      
      // Expected: "packages/shared-types/config.ts" (no :summary suffix)
      expect(configInstruction).toBe('packages/shared-types/config.ts');
      expect(resolutionWarnings.some(w => w.includes('config.ts'))).toBe(true);
    });

    it('should produce :summary suffix only when no Full resolution is requested', async () => {
      const fileIndex = harness.getFileIndex();
      const graph = harness.getSymbolGraph();

      // Only trace, no seeds for shared-types
      const state = createBaseState({
        traceQuery: 'packages/web/App.tsx',
        traceDepth: 1,      // App (0) -> ComplexBarrel (0) -> components/index (0)
        summaryTraceDepth: 5 // Will reach shared-types/inheritance.ts at depth > 1
      });

      const { paths } = await discoverContextPaths(fileIndex, graph, state);

      const inheritance = paths.find(p => p.includes('inheritance.ts'));
      expect(inheritance).toBe('packages/shared-types/inheritance.ts:summary');
    });
  });
});