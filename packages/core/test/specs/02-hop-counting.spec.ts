/**
 * @file packages/core/test/specs/02-hop-counting.spec.ts
 * @stamp {"ts":"2026-02-16T20:20:00Z"}
 * @architectural-role Test Suite
 * @test-target packages/core/src/logic/symbolGraph/augmentedTracer.ts
 *
 * @description
 * Structural integration test validating the distance calculation heuristics.
 * Verifies that the BFS traversal correctly utilizes the Two-Part Pipe Rule 
 * to bypass organizational barrels while maintaining physical path integrity.
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
import { NetworkHarness } from '../harness/network-harness.js';
import { traceLogicalPath } from '../../src/logic/symbolGraph/augmentedTracer.js';
import { traceSymbolGraph } from '../../src/logic/symbolGraph/tracer.js';

describe('Integration: Logical vs Physical Hop Counting', () => {
  let harness: NetworkHarness;

  beforeAll(async () => {
    harness = await NetworkHarness.bootstrap();
  });

  it('should verify the "Wormhole" effect: 5 Physical junctions vs 1 Logical hop', () => {
    const graph = harness.getSymbolGraph();
    const fileIndex = harness.getFileIndex();
    
    // We need an AST cache for the logical tracer
    const astCache = new Map<string, any>();
    for (const [path] of fileIndex) {
      astCache.set(path, harness.getAst(path));
    }

    const seed = 'packages/web/App.tsx';
    const target = 'packages/ui-kit/components/buttons/core/Button.tsx';

    // 1. Physical Trace (Traditional BFS)
    // Chain: App -> ComplexBarrel -> components/index -> buttons/index -> core/index -> Button.tsx
    // The traditional tracer counts every file junction as 1 hop.
    const physicalResults = traceSymbolGraph(graph, seed, 'dependencies', 5);
    expect(physicalResults).toContain(target);

    // 2. Logical Trace (Smart Trace)
    // The intermediate files (ComplexBarrel, components/index, etc.) are all Pure Pipes.
    // Pipe Rule: Cost 0. Button.tsx = Logic (Cost 1).
    const logicalResults = traceLogicalPath(graph, astCache, seed, {
      mode: 'logical',
      direction: 'dependencies',
      maxHops: 1, 
      summaryHops: 1
    });

    const buttonEntry = logicalResults.find(r => r.path === target);
    
    expect(buttonEntry).toBeDefined();
    // The logical depth should be 1 because all intermediate barrels cost 0.
    expect(buttonEntry?.depth).toBe(1);
    expect(buttonEntry?.status).toBe('meaningful');
  });

  it('should correctly identify a Logic Junction (Cost 1) despite being physically adjacent', () => {
    const graph = harness.getSymbolGraph();
    const fileIndex = harness.getFileIndex();
    const astCache = new Map<string, any>();
    for (const [path] of fileIndex) {
      astCache.set(path, harness.getAst(path));
    }

    const seed = 'packages/web/App.tsx';
    const target = 'packages/web/userService.ts';

    // App.tsx imports userService.ts directly.
    // userService.ts is Logic (Cost 1).
    const results = traceLogicalPath(graph, astCache, seed, {
      mode: 'logical',
      direction: 'dependencies',
      maxHops: 1,
      summaryHops: 1
    });

    const userSvc = results.find(r => r.path === target);
    expect(userSvc).toBeDefined();
    expect(userSvc?.depth).toBe(1);
    expect(userSvc?.status).toBe('meaningful');
  });

  it('should terminate circular dependencies (Möbius Loop) at the logical boundary', () => {
    const graph = harness.getSymbolGraph();
    const fileIndex = harness.getFileIndex();
    const astCache = new Map<string, any>();
    for (const [path] of fileIndex) {
      astCache.set(path, harness.getAst(path));
    }

    // userService <-> validator (Circular)
    const seed = 'packages/web/userService.ts';
    
    const results = traceLogicalPath(graph, astCache, seed, {
      mode: 'logical',
      direction: 'both',
      maxHops: 5,
      summaryHops: 5
    });

    // Verify both are present without infinite recursion
    expect(results.some(r => r.path === 'packages/web/userService.ts')).toBe(true);
    expect(results.some(r => r.path === 'packages/web/validator.ts')).toBe(true);
    
    // BFS visited sets should keep the result size sane
    expect(results.length).toBeLessThan(50);
  });

  it('should exclude distant logic chains that exceed the logical budget', () => {
    const graph = harness.getSymbolGraph();
    const fileIndex = harness.getFileIndex();
    const astCache = new Map<string, any>();
    for (const [path] of fileIndex) {
      astCache.set(path, harness.getAst(path));
    }

    const seed = 'packages/web/App.tsx';
    // Chain: App -> ScentChainA (1) -> ScentChainB (2) -> ScentChainC (3)
    
    const results = traceLogicalPath(graph, astCache, seed, {
      mode: 'logical',
      direction: 'dependencies',
      maxHops: 2,
      summaryHops: 2
    });

    const chainB = results.find(r => r.path === 'packages/web/ScentChainB.ts');
    const chainC = results.find(r => r.path === 'packages/web/ScentChainC.ts');

    expect(chainB).toBeDefined();
    expect(chainC).toBeUndefined(); // Hop 3 is out of budget
  });
});