/**
 * @file packages/core/src/logic/symbolGraph/augmentedTracer.spec.ts
 * @stamp {"ts":"2026-02-14T15:05:00Z"}
 * @architectural-role Business Logic
 * @test-target packages/core/src/logic/symbolGraph/augmentedTracer.ts
 * 
 * @description
 * Integration tests for the augmented logical tracing engine. Verifies the 
 * dual-hop resolution logic, scent tracking, and the enforcement of the 
 * Autosummarize rule for barrels and passive pipes.
 * 
 * @criticality Critical (Reason: Core engine for context resolution gradient)
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

describe('traceLogicalPath (Augmented)', () => {
  const mockAstCache = new Map<string, any>();
  
  /**
   * Mock Filesystem structure:
   * App.tsx (Seed) -> index.ts (Barrel) -> LogicA.tsx (Meaningful) -> LogicB.tsx (Meaningful)
   */
  mockAstCache.set('App.tsx', parseToAst("import { LogicA } from './index';"));
  mockAstCache.set('index.ts', parseToAst("export * from './LogicA';"));
  
  // LogicA is meaningful because it accesses data.id
  mockAstCache.set('LogicA.tsx', parseToAst(`
    import { LogicB } from './LogicB'; 
    export const LogicA = (data) => {
      console.log(data.id);
      return <LogicB data={data} />;
    };
  `));
  
  // LogicB is meaningful because it accesses data.name
  mockAstCache.set('LogicB.tsx', parseToAst(`
    export const LogicB = (data) => {
      return <div>{data.name}</div>;
    };
  `));

  const graph: SymbolGraph = new Map();
  graph.set('App.tsx', createNode('App.tsx', 'App.tsx', '(file)', ['index.ts']));
  graph.set('index.ts', createNode('index.ts', 'index.ts', '(file)', ['LogicA.tsx']));
  graph.set('LogicA.tsx', createNode('LogicA.tsx', 'LogicA.tsx', 'LogicA', ['LogicB.tsx']));
  graph.set('LogicB.tsx', createNode('LogicB.tsx', 'LogicB.tsx', 'LogicB', []));

  it('should assign resolutions correctly based on dual hop thresholds', () => {
    // maxHops: 1 (Full), summaryHops: 2 (Summary)
    const results = traceLogicalPath(graph, mockAstCache, 'App.tsx', {
      mode: 'logical',
      direction: 'dependencies',
      maxHops: 1,
      summaryHops: 2,
      initialScent: 'data'
    });

    const logicAResult = results.find(r => r.path === 'LogicA.tsx');
    const logicBResult = results.find(r => r.path === 'LogicB.tsx');

    // LogicA is reached via index.ts (cost 0). LogicA itself is meaningful (cost 1).
    // Final depth for LogicA: 1.
    expect(logicAResult?.depth).toBe(1);
    expect(logicAResult?.resolution).toBe('full');

    // LogicB is reached from LogicA (depth 1). LogicB itself is meaningful (cost 1).
    // Final depth for LogicB: 2.
    expect(logicBResult?.depth).toBe(2);
    expect(logicBResult?.resolution).toBe('summary');
  });

  it('should ALWAYS summarize barrels even if they are within the full-text hop limit', () => {
    const results = traceLogicalPath(graph, mockAstCache, 'App.tsx', {
      mode: 'logical',
      direction: 'dependencies',
      maxHops: 5,
      summaryHops: 5,
      initialScent: 'data'
    });

    const indexResult = results.find(r => r.path === 'index.ts');
    
    // index.ts is logical hop 0 (barrel), but it must be summarized by policy
    expect(indexResult?.status).toBe('passive');
    expect(indexResult?.resolution).toBe('summary');
  });

  it('should summarize passive pipes that do not meaningfully interact with the scent', () => {
    // Pipe.tsx: Purely forwards data (Exclusion B in flowAnalyzer)
    mockAstCache.set('Pipe.tsx', parseToAst("import { Final } from './Final'; export const Pipe = ({ data }) => <Final data={data} />;"));
    mockAstCache.set('Final.tsx', parseToAst("export const Final = ({ data }) => <div>{data.name}</div>;"));
    
    const pipeGraph: SymbolGraph = new Map();
    pipeGraph.set('Start.tsx', createNode('Start.tsx', 'Start.tsx', '(file)', ['Pipe.tsx']));
    pipeGraph.set('Pipe.tsx', createNode('Pipe.tsx', 'Pipe.tsx', 'Pipe', ['Final.tsx']));
    pipeGraph.set('Final.tsx', createNode('Final.tsx', 'Final.tsx', 'Final', []));

    const results = traceLogicalPath(pipeGraph, mockAstCache, 'Start.tsx', {
      mode: 'logical',
      direction: 'dependencies',
      maxHops: 5,
      summaryHops: 5,
      initialScent: 'data'
    });

    const pipeResult = results.find(r => r.path === 'Pipe.tsx');
    const finalResult = results.find(r => r.path === 'Final.tsx');

    // Pipe is 0 logical hops (passive), Final is 1 logical hop (meaningful)
    expect(pipeResult?.status).toBe('passive');
    expect(pipeResult?.resolution).toBe('summary');
    
    expect(finalResult?.status).toBe('meaningful');
    expect(finalResult?.resolution).toBe('full');
  });

  it('should respect the summaryHops outer boundary', () => {
    const results = traceLogicalPath(graph, mockAstCache, 'App.tsx', {
      mode: 'logical',
      direction: 'dependencies',
      maxHops: 0,
      summaryHops: 1, 
      initialScent: 'data'
    });

    const paths = results.map(r => r.path);
    expect(paths).toContain('LogicA.tsx'); // LogicA depth is 1
    expect(paths).not.toContain('LogicB.tsx'); // LogicB depth is 2
  });
});