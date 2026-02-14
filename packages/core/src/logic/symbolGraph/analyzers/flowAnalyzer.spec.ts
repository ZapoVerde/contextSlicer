/**
 * @file packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.spec.ts
 * @stamp {"ts":"2026-02-14T07:42:00Z"}
 * @architectural-role Business Logic
 * @test-target packages/core/src/logic/symbolGraph/analyzers/flowAnalyzer.ts
 * 
 * @description
 * Unit tests for the Scent-Sensitive Flow Analyzer. Verifies the "Meaningful vs. Passive" 
 * binary heuristic and identifier aliasing (renaming) detection.
 * 
 * @criticality Critical (Reason: Core heuristic for logical tracing and scent tracking)
 * @testing-layer Unit
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import { analyzeFlow } from './flowAnalyzer';

function parse(code: string) {
  return parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
}

describe('analyzeFlow', () => {
  describe('Passive Patterns (isMeaningful: false)', () => {
    it('should identify simple function parameters as passive', () => {
      const ast = parse('function test(user) { return; }');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(false);
    });

    it('should identify destructured function parameters as passive', () => {
      const ast = parse('const fn = ({ user }) => {};');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(false);
    });

    it('should identify pure re-exports as passive', () => {
      const ast = parse('const user = {}; export { user };');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(false);
    });

    it('should identify same-name JSX forwarding as passive', () => {
      const ast = parse('const UI = () => <Child user={user} />;');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(false);
    });

    it('should identify shorthand destructuring as passive', () => {
      const ast = parse('const { user } = props;');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(false);
    });

    it('should identify return statements as passive', () => {
      const ast = parse('function get() { return user; }');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(false);
    });
  });

  describe('Meaningful Patterns (isMeaningful: true)', () => {
    it('should identify renaming via destructuring as meaningful and update scent', () => {
      const ast = parse('const { user: account } = props;');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(true);
      expect(result.nextIdentifier).toBe('account');
    });

    it('should identify renaming via assignment as meaningful and update scent', () => {
      const ast = parse('const account = user;');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(true);
      expect(result.nextIdentifier).toBe('account');
    });

    it('should identify JSX rendering as meaningful', () => {
      const ast = parse('const UI = () => <div>{user}</div>;');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(true);
    });

    it('should identify different-name JSX forwarding as meaningful (contract change)', () => {
      const ast = parse('const UI = () => <Child data={user} />;');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(true);
    });

    it('should identify member access as meaningful', () => {
      const ast = parse('console.log(user.name);');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(true);
    });

    it('should identify logic branching as meaningful', () => {
      const ast = parse('if (user) { doWork(); }');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(true);
    });

    it('should identify hook dependencies as meaningful', () => {
      const ast = parse('useEffect(() => {}, [user]);');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(true);
    });

    it('should identify function calls as meaningful', () => {
      const ast = parse('validate(user);');
      const result = analyzeFlow(ast, 'user');
      expect(result.isMeaningful).toBe(true);
    });
  });
});