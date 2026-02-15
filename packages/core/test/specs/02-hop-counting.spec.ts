/**
 * @file packages/core/test/specs/02-hop-counting.spec.ts
 * @stamp {"ts":"2026-02-15T21:15:00Z"}
 * @architectural-role Test Suite
 * @description
 * Validates the distance calculation heuristics of the Augmented Tracer.
 * Compares Physical vs. Logical hop counts to verify that the Two-Part Pipe 
 * Rule correctly reduces noise by bypassing structural passthroughs.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NetworkHarness } from '../harness/network-harness';
import { traceLogicalPath } from '../../src/logic/symbolGraph/augmentedTracer';
import { traceSymbolGraph } from '../../src/logic/symbolGraph/tracer';

describe('Logical vs Physical Hop Counting', () => {
  let harness: NetworkHarness;

  beforeAll(async () => {
    harness = await NetworkHarness.bootstrap();
  });

  it('should verify the "Wormhole" effect: 4 Physical hops vs 1 Logical hop', () => {
    const graph = harness.getSymbolGraph();
    const astCache = harness.getAstCache();
    const seed = 'packages/web/App.tsx';
    const target = 'packages/ui-kit/components/buttons/core/Button.tsx';

    // 1. Physical Trace (Traditional BFS)
    // App -> ComplexBarrel -> components/index -> buttons/index -> core/index -> Button.tsx
    // (Note: tracer.ts counts every file junction as a hop)
    const physicalResults = traceSymbolGraph(graph, seed, 'dependencies', 5);
    expect(physicalResults).toContain(target);

    // 2. Logical Trace (Smart Trace)
    // The chain contains 4 consecutive Pipes (ComplexBarrel, components/index, buttons/index, core/index)
    // These cost 0. Only Button.tsx is Logic, costing 1.
    const logicalResults = traceLogicalPath(graph, astCache, seed, {
      mode: 'logical',
      direction: 'dependencies',
      maxHops: 1, // We only allow ONE logical junction
      summaryHops: 1
    });

    const buttonEntry = logicalResults.find(r => r.path === target);
    
    expect(buttonEntry).toBeDefined();
    expect(buttonEntry?.depth).toBe(1); // Logical depth is 1
    expect(buttonEntry?.status).toBe('meaningful');
  });

  it('should terminate the "Möbius Loop" (Circular Dependency) without error', () => {
    const graph = harness.getSymbolGraph();
    const astCache = harness.getAstCache();
    const seed = 'packages/web/userService.ts';
    const circularTarget = 'packages/web/validator.ts';

    // userService <-> validator
    const results = traceLogicalPath(graph, astCache, seed, {
      mode: 'logical',
      direction: 'both',
      maxHops: 2,
      summaryHops: 2
    });

    const validator = results.find(r => r.path === circularTarget);
    const userService = results.find(r => r.path === seed);

    expect(validator).toBeDefined();
    expect(userService).toBeDefined();
    // BFS de-duplication prevents infinite recursion
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('should identify a Logic Junction at hop 1 even if reached through a Pipe', () => {
    const graph = harness.getSymbolGraph();
    const astCache = harness.getAstCache();
    const seed = 'packages/web/App.tsx';
    const target = 'packages/ui-kit/index.ts';

    // App -> ComplexBarrel (Pipe, 0) -> ui-kit/index.ts (Logic/Side-effect, 1)
    const results = traceLogicalPath(graph, astCache, seed, {
      mode: 'logical',
      direction: 'dependencies',
      maxHops: 1,
      summaryHops: 1
    });

    const uiKitIndex = results.find(r => r.path === target);
    
    expect(uiKitIndex).toBeDefined();
    expect(uiKitIndex?.depth).toBe(1); 
    expect(uiKitIndex?.status).toBe('meaningful'); // It has a side effect (console.log)
  });

  it('should exclude distant logic files that exceed the logical hop budget', () => {
    const graph = harness.getSymbolGraph();
    const astCache = harness.getAstCache();
    const seed = 'packages/web/App.tsx';
    
    // Trace: App -> ScentChainA (1) -> ScentChainB (2) -> ScentChainC (3)
    // If maxHops is 2, ScentChainC should be absent.
    const results = traceLogicalPath(graph, astCache, seed, {
      mode: 'logical',
      direction: 'dependencies',
      maxHops: 2,
      summaryHops: 2
    });

    const chainC = results.find(r => r.path === 'packages/web/ScentChainC.ts');
    expect(chainC).toBeUndefined();
  });
});