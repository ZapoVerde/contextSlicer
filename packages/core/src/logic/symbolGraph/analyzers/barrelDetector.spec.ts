/**
 * @file packages/core/src/logic/symbolGraph/analyzers/barrelDetector.spec.ts
 * @stamp {"ts":"2026-02-14T07:25:00Z"}
 * @architectural-role Business Logic
 * @test-target packages/core/src/logic/symbolGraph/analyzers/barrelDetector.ts
 * 
 * @description
 * Unit tests for the barrel detection heuristic. Verifies that index/barrel files 
 * are identified for logical bypass while files with runtime or contract logic 
 * are protected.
 * 
 * @criticality Critical (Reason: Core heuristic for logical tracing accuracy)
 * @testing-layer Unit
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import { isBarrelFile } from './barrelDetector';

function parse(code: string) {
  return parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
}

describe('isBarrelFile', () => {
  it('should return true for wildcard re-exports', () => {
    const ast = parse("export * from './other';");
    expect(isBarrelFile(ast)).toBe(true);
  });

  it('should return true for named re-exports', () => {
    const ast = parse("export { a, b } from './other';");
    expect(isBarrelFile(ast)).toBe(true);
  });

  it('should return true for mixed imports and re-exports', () => {
    const ast = parse(`
      import { x } from './utils';
      export { x };
      export * from './types';
    `);
    expect(isBarrelFile(ast)).toBe(true);
  });

  it('should return false if it contains a variable declaration', () => {
    const ast = parse(`
      export const foo = 'bar';
      export * from './other';
    `);
    expect(isBarrelFile(ast)).toBe(false);
  });

  it('should return false if it contains an interface definition', () => {
    // Architectural Choice: Defining a contract is a meaningful junction.
    const ast = parse(`
      export interface Config {
        port: number;
      }
      export * from './service';
    `);
    expect(isBarrelFile(ast)).toBe(false);
  });

  it('should return false if it contains a function declaration', () => {
    const ast = parse(`
      export function helper() { return true; }
    `);
    expect(isBarrelFile(ast)).toBe(false);
  });

  it('should return false if it contains side-effect logic', () => {
    const ast = parse(`
      import { init } from './init';
      init();
      export * from './module';
    `);
    expect(isBarrelFile(ast)).toBe(false);
  });

  it('should return true for type-only re-exports from another file', () => {
    const ast = parse("export type { User } from './types';");
    expect(isBarrelFile(ast)).toBe(true);
  });
});