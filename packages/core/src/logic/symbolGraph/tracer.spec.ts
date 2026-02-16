/**
 * @file packages/core/src/logic/symbolGraph/tracer.spec.ts
 * @stamp {"ts":"2026-02-16T20:45:00Z"}
 * @architectural-role Test Suite
 * @description
 * Integration test for the Augmented Tracer and Pipe Detection logic.
 * Updated to support the optimized tracer signature which consumes structural 
 * flags directly from nodes instead of requiring an AST Cache.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { traceLogicalPath } from './augmentedTracer.js';
import type { SymbolGraph } from './types.js';

// --- TEST SETUP ---

describe('Gradient Tracer Integration', () => {
  let graph: SymbolGraph;

  beforeAll(() => {
    // 1. Build Symbol Graph (Manual Topology)
    // SIGNATURE FIX: Nodes now require hasReexports and hasLogicActivity flags.
    graph = new Map();
    const createNode = (
      path: string, 
      deps: string[], 
      dependents: string[], 
      hasReexports: boolean, 
      hasLogicActivity: boolean
    ) => {
      graph.set(path, {
        id: path,
        filePath: path,
        symbolName: '(file)',
        dependencies: new Set(deps),
        dependents: new Set(dependents),
        hasReexports,
        hasLogicActivity
      });
    };

    // ZONE A: Target
    // feature-a/index.ts is a pure PIPE (Cost 0)
    createNode('feature-a/index.ts', 
      ['feature-a/Component.tsx', 'feature-a/useFeature.ts', 'feature-a/types.ts'], 
      ['app/EntryPoint.tsx'],
      true, false
    );

    // feature-a logic components (Cost 1)
    createNode('feature-a/Component.tsx', ['feature-a/useFeature.ts'], ['feature-a/index.ts'], false, true);
    createNode('feature-a/useFeature.ts', ['shared/index.ts'], ['feature-a/index.ts', 'feature-a/Component.tsx'], false, true);
    createNode('feature-a/types.ts', [], ['feature-a/index.ts'], false, true);

    // ZONE B: Upstream
    // shared/index.ts is a PIPE (Cost 0)
    createNode('shared/index.ts', ['shared/formatter.ts'], ['feature-a/useFeature.ts'], true, false);
    createNode('shared/formatter.ts', [], ['shared/index.ts'], false, true);

    // ZONE C: Downstream
    createNode('app/EntryPoint.tsx', ['feature-a/index.ts'], ['app/Router.tsx'], false, true);
    createNode('app/Router.tsx', ['app/EntryPoint.tsx'], [], false, true);
  });

  // --- SCENARIO 1: Seed Only (0:0) ---
  it('Scenario 0:0 - Should return only the seed', () => {
    // SIGNATURE FIX: Removed astCache argument.
    const results = traceLogicalPath(graph, 'feature-a/index.ts', {
      mode: 'logical',
      direction: 'both',
      maxHops: 0,
      summaryHops: 0
    });

    expect(results.length).toBe(1);
    expect(results[0].path).toBe('feature-a/index.ts');
    expect(results[0].resolution).toBe('full');
  });

  // --- SCENARIO 2: Seed + 1 Hop Summary (0:1) ---
  it('Scenario 0:1 - Should summarize immediate neighbors', () => {
    // SIGNATURE FIX: Removed astCache argument.
    const results = traceLogicalPath(graph, 'feature-a/index.ts', {
      mode: 'logical',
      direction: 'both',
      maxHops: 0, 
      summaryHops: 1
    });

    const paths = results.map(r => r.path);
    
    expect(paths).toContain('feature-a/Component.tsx');
    expect(paths).toContain('feature-a/useFeature.ts');
    expect(paths).toContain('app/EntryPoint.tsx');

    const component = results.find(r => r.path === 'feature-a/Component.tsx');
    expect(component?.resolution).toBe('summary');
  });

  // --- SCENARIO 3: Seed + 1 Hop Full (1:1) ---
  it('Scenario 1:1 - Should provide full code for Logic neighbors', () => {
    // SIGNATURE FIX: Removed astCache argument.
    const results = traceLogicalPath(graph, 'feature-a/index.ts', {
      mode: 'logical',
      direction: 'both',
      maxHops: 1,
      summaryHops: 1
    });

    const component = results.find(r => r.path === 'feature-a/Component.tsx');
    const entryPoint = results.find(r => r.path === 'app/EntryPoint.tsx');

    expect(component?.resolution).toBe('full');
    expect(entryPoint?.resolution).toBe('full');
  });

  // --- SCENARIO 4: Seed + 1 Full + 2 Summary (1:2) ---
  it('Scenario 1:2 - Should pass through Pipes to find distant Logic', () => {
    // SIGNATURE FIX: Removed astCache argument.
    const results = traceLogicalPath(graph, 'feature-a/index.ts', {
      mode: 'logical',
      direction: 'both',
      maxHops: 1,
      summaryHops: 2
    });

    const paths = results.map(r => r.path);

    // Trace: Index (0) -> useFeature (1) -> shared/index (Pipe, +0) -> formatter (2)
    const formatter = results.find(r => r.path === 'shared/formatter.ts');
    
    expect(paths).toContain('shared/index.ts');
    expect(paths).toContain('shared/formatter.ts');
    
    expect(formatter?.depth).toBe(2);
    expect(formatter?.resolution).toBe('summary');
  });
});