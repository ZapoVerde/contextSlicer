/**
 * @file packages/core/src/logic/symbolGraph/augmentedTracer.spec.ts
 * @stamp {"ts":"2026-02-14T08:10:00Z"}
 * @architectural-role Business Logic
 * @test-target packages/core/src/logic/symbolGraph/augmentedTracer.ts
 * 
 * @description
 * Integration tests for the logical tracing engine. Verifies the "Wormhole" 
 * traversal logic, ensuring that passthrough components and barrels do not 
 * consume hops while meaningful junctions and renaming events do.
 * 
 * @criticality Critical (Reason: Core engine for context pack generation)
 * @testing-layer Integration
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import { traceLogicalPath } from './augmentedTracer';
import type { SymbolGraph, SymbolNode } from './types';

// Helper to create a minimal SymbolNode
function createNode(id: string, path: string, symbolName: string, deps: string[] = []): SymbolNode {
  return {
    id,
    filePath: path,
    symbolName,
    dependencies: new Set(deps),
    dependents: new Set(),
  };
}

// Helper to parse code into an AST node
function parseToAst(code: string) {
  return parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
}

describe('traceLogicalPath', () => {
  const mockAstCache = new Map<string, any>();
  
  // Define a mock codebase
  // 1. App.tsx (Start)
  // 2. index.ts (Barrel)
  // 3. Wrapper.tsx (Passive Pipe)
  // 4. Aliased.tsx (Renaming Junction)
  // 5. Logic.tsx (Meaningful Junction)
  
  mockAstCache.set('App.tsx', parseToAst("import { User } from './index';"));
  mockAstCache.set('index.ts', parseToAst("export * from './Wrapper';"));
  mockAstCache.set('Wrapper.tsx', parseToAst("import { User } from './Aliased'; export const Wrapper = ({ user }) => <Aliased user={user} />;"));
  mockAstCache.set('Aliased.tsx', parseToAst("import { User } from './Logic'; export const Aliased = ({ user: account }) => <Logic account={account} />;"));
  mockAstCache.set('Logic.tsx', parseToAst("export const Logic = ({ account }) => <div>{account.name}</div>;"));

  const graph: SymbolGraph = new Map();
  graph.set('App.tsx', createNode('App.tsx', 'App.tsx', '(file)', ['index.ts']));
  graph.set('index.ts', createNode('index.ts', 'index.ts', '(file)', ['Wrapper.tsx']));
  graph.set('Wrapper.tsx', createNode('Wrapper.tsx', 'Wrapper.tsx', 'Wrapper', ['Aliased.tsx']));
  graph.set('Aliased.tsx', createNode('Aliased.tsx', 'Aliased.tsx', 'Aliased', ['Logic.tsx']));
  graph.set('Logic.tsx', createNode('Logic.tsx', 'Logic.tsx', 'Logic', []));

  it('should treat barrels and passive pipes as 0-hop wormholes in logical mode', () => {
    const results = traceLogicalPath(graph, mockAstCache, 'App.tsx', {
      mode: 'logical',
      direction: 'dependencies',
      maxHops: 1, // Only enough for 1 junction
      initialScent: 'user'
    });

    const paths = results.map(r => r.path);
    
    // Should include App (start), index (barrel: 0), Wrapper (pipe: 0), Aliased (rename: 1)
    // Should NOT include Logic (needs 2 logical hops: 1 for Aliased, 1 for Logic)
    expect(paths).toContain('App.tsx');
    expect(paths).toContain('index.ts');
    expect(paths).toContain('Wrapper.tsx');
    expect(paths).toContain('Aliased.tsx');
    expect(paths).not.toContain('Logic.tsx');
    
    const aliasedResult = results.find(r => r.path === 'Aliased.tsx');
    expect(aliasedResult?.status).toBe('meaningful');
    expect(aliasedResult?.depth).toBe(1);
  });

  it('should track the scent name change across aliasing junctions', () => {
    const results = traceLogicalPath(graph, mockAstCache, 'App.tsx', {
      mode: 'logical',
      direction: 'dependencies',
      maxHops: 2,
      initialScent: 'user'
    });

    const logicResult = results.find(r => r.path === 'Logic.tsx');
    expect(logicResult).toBeDefined();
    expect(logicResult?.status).toBe('meaningful');
    expect(logicResult?.depth).toBe(2);
    // Scent changed from 'user' to 'account' in Aliased.tsx
    expect(logicResult?.scent).toBe('account');
  });

  it('should count every file as 1 hop in physical mode', () => {
    const results = traceLogicalPath(graph, mockAstCache, 'App.tsx', {
      mode: 'physical',
      direction: 'dependencies',
      maxHops: 1,
      initialScent: 'user'
    });

    const paths = results.map(r => r.path);
    
    // In physical mode, index.ts is hop 1. Nothing else should be reached.
    expect(paths).toContain('App.tsx');
    expect(paths).toContain('index.ts');
    expect(paths).not.toContain('Wrapper.tsx');
  });

  it('should respect the physical circuit breaker for very deep logical paths', () => {
    // Construct a long chain of barrels
    const deepGraph: SymbolGraph = new Map();
    deepGraph.set('start.ts', createNode('start.ts', 'start.ts', '(file)', ['1.ts']));
    mockAstCache.set('start.ts', parseToAst("export * from './1'"));
    
    for (let i = 1; i <= 60; i++) {
      const current = `${i}.ts`;
      const next = `${i + 1}.ts`;
      deepGraph.set(current, createNode(current, current, '(file)', [next]));
      mockAstCache.set(current, parseToAst(`export * from './${i + 1}'`));
    }

    const results = traceLogicalPath(deepGraph, mockAstCache, 'start.ts', {
      mode: 'logical',
      direction: 'dependencies',
      maxHops: 10,
      initialScent: 'user'
    });

    // PHYSICAL_LIMIT is 50. We shouldn't reach file 60.
    const paths = results.map(r => r.path);
    expect(paths.length).toBeLessThanOrEqual(51); // Start + 50 hops
    expect(paths).not.toContain('60.ts');
  });
});