/**
 * @file packages/core/src/logic/symbolGraph/tracer.spec.ts
 * @stamp {"ts":"2026-02-15T20:00:00Z"}
 * @architectural-role Test Suite
 * @description
 * Integration test for the Augmented Tracer and Pipe Detection logic.
 * Simulates the "Gradient Test Bed" network to verify hop counting and 
 * resolution assignment.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as parser from '@babel/parser';
import { traceLogicalPath } from './augmentedTracer';
import type { SymbolGraph, SymbolNode } from './types';

// --- MOCK DATA (Matches setup-network.js) ---

const FILES = {
  // ZONE A: Target
  'feature-a/index.ts': `
    export * from './Component';
    export * from './useFeature';
    export * from './types';
  `, // PIPE (Cost 0)

  'feature-a/Component.tsx': `
    import React from 'react';
    import { useFeature } from './useFeature';
    export const Component = () => {
      const { data } = useFeature();
      return <div>{data}</div>;
    };
  `, // LOGIC (Cost 1) - Has JSX

  'feature-a/useFeature.ts': `
    import { useState, useEffect } from 'react';
    import { formatData } from '../shared';
    export function useFeature() {
      useEffect(() => {}, []);
      return { data: null };
    }
  `, // LOGIC (Cost 1) - Has Hooks

  'feature-a/types.ts': `
    export interface FeatureConfig { enabled: boolean; }
  `, // LOGIC (Cost 1) - Has Definition

  // ZONE B: Upstream
  'shared/index.ts': `
    export * from './formatter';
  `, // PIPE (Cost 0)

  'shared/formatter.ts': `
    export function formatData(input: string) { return input; }
  `, // LOGIC (Cost 1)

  // ZONE C: Downstream
  'app/EntryPoint.tsx': `
    import { Component } from '../feature-a';
    export const EntryPoint = () => <Component />;
  `, // LOGIC (Cost 1)

  'app/Router.tsx': `
    import { EntryPoint } from './EntryPoint';
    export const Router = () => <EntryPoint />;
  ` // LOGIC (Cost 1)
};

// --- TEST SETUP ---

describe('Gradient Tracer Integration', () => {
  let graph: SymbolGraph;
  let astCache: Map<string, any>;

  beforeAll(() => {
    // 1. Build AST Cache
    astCache = new Map();
    Object.entries(FILES).forEach(([path, code]) => {
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });
      astCache.set(path, ast);
    });

    // 2. Build Symbol Graph (Manual Topology to guarantee connections)
    graph = new Map();
    const createNode = (path: string, deps: string[], dependents: string[]) => {
      graph.set(path, {
        id: path,
        filePath: path,
        symbolName: '(file)',
        dependencies: new Set(deps),
        dependents: new Set(dependents)
      });
    };

    // Define Topology
    // feature-a/index.ts depends on Component, useFeature, types
    // feature-a/index.ts is used by app/EntryPoint
    createNode('feature-a/index.ts', 
      ['feature-a/Component.tsx', 'feature-a/useFeature.ts', 'feature-a/types.ts'], 
      ['app/EntryPoint.tsx']
    );

    createNode('feature-a/Component.tsx', ['feature-a/useFeature.ts'], ['feature-a/index.ts']);
    // useFeature depends on shared/index (via import)
    createNode('feature-a/useFeature.ts', ['shared/index.ts'], ['feature-a/index.ts', 'feature-a/Component.tsx']);
    createNode('feature-a/types.ts', [], ['feature-a/index.ts']);

    // shared/index depends on formatter
    createNode('shared/index.ts', ['shared/formatter.ts'], ['feature-a/useFeature.ts']);
    createNode('shared/formatter.ts', [], ['shared/index.ts']);

    // EntryPoint depends on feature-a/index
    createNode('app/EntryPoint.tsx', ['feature-a/index.ts'], ['app/Router.tsx']);
    createNode('app/Router.tsx', ['app/EntryPoint.tsx'], []);
  });

  // --- SCENARIO 1: Seed Only (0:0) ---
  it('Scenario 0:0 - Should return only the seed', () => {
    const results = traceLogicalPath(graph, astCache, 'feature-a/index.ts', {
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
    const results = traceLogicalPath(graph, astCache, 'feature-a/index.ts', {
      mode: 'logical',
      direction: 'both',
      maxHops: 0, // Full Code limit
      summaryHops: 1 // Summary limit
    });

    // We expect:
    // Depth 0: feature-a/index.ts (Full - Seed is always full)
    // Depth 1: Component, useFeature, types, EntryPoint (Summary)
    // shared/index.ts is a Pipe (Cost 0). It might be included as a summary if visited.

    const paths = results.map(r => r.path);
    
    // Check Depth 1 neighbors
    expect(paths).toContain('feature-a/Component.tsx');
    expect(paths).toContain('feature-a/useFeature.ts');
    expect(paths).toContain('app/EntryPoint.tsx');

    // Verify Resolution
    const component = results.find(r => r.path === 'feature-a/Component.tsx');
    expect(component?.resolution).toBe('summary');
  });

  // --- SCENARIO 3: Seed + 1 Hop Full (1:1) ---
  it('Scenario 1:1 - Should provide full code for Logic neighbors', () => {
    const results = traceLogicalPath(graph, astCache, 'feature-a/index.ts', {
      mode: 'logical',
      direction: 'both',
      maxHops: 1,
      summaryHops: 1
    });

    // Logic Neighbors should be Full
    const component = results.find(r => r.path === 'feature-a/Component.tsx');
    const entryPoint = results.find(r => r.path === 'app/EntryPoint.tsx');

    expect(component?.resolution).toBe('full');
    expect(entryPoint?.resolution).toBe('full');
  });

  // --- SCENARIO 4: Seed + 1 Full + 2 Summary (1:2) ---
  // This is the critical test for the Pipe Rule
  it('Scenario 1:2 - Should pass through Pipes to find distant Logic', () => {
    const results = traceLogicalPath(graph, astCache, 'feature-a/index.ts', {
      mode: 'logical',
      direction: 'both',
      maxHops: 1,
      summaryHops: 2
    });

    const paths = results.map(r => r.path);

    // 1. Immediate Neighbors (Depth 1) -> Full
    const useFeature = results.find(r => r.path === 'feature-a/useFeature.ts');
    expect(useFeature?.resolution).toBe('full');

    // 2. Distant Neighbors (Depth 2) -> Summary
    // Trace: Index -> EntryPoint (1) -> Router (2)
    const router = results.find(r => r.path === 'app/Router.tsx');
    expect(paths).toContain('app/Router.tsx');
    expect(router?.depth).toBe(2);
    expect(router?.resolution).toBe('summary');

    // 3. Pipe Traversal (The Wormhole)
    // Trace: Index -> useFeature (1) -> shared/index (Pipe, +0) -> formatter (2)
    const formatter = results.find(r => r.path === 'shared/formatter.ts');
    
    expect(paths).toContain('shared/index.ts'); // The pipe itself is visited
    expect(paths).toContain('shared/formatter.ts'); // The destination is reached
    
    expect(formatter?.depth).toBe(2);
    expect(formatter?.resolution).toBe('summary');
  });
});