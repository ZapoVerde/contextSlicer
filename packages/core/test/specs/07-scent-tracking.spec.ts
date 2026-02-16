/**
 * @file packages/core/test/specs/07-scent-tracking.spec.ts
 * @stamp {"ts":"2026-02-15T23:45:00Z"}
 * @architectural-role Test Suite
 * @description
 * Validates the "Identity Scent" detection capabilities. This suite ensures 
 * that the flow analyzer recognizes identifier transformations (renames, 
 * destructuring) as meaningful logic, preventing files that transform 
 * data from being misclassified as passive pipes.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NetworkHarness } from '../harness/network-harness';
import { hasLogicActivity } from '../../src/logic/symbolGraph/analyzers/flowAnalyzer';
import { hasReexports } from '../../src/logic/symbolGraph/analyzers/barrelDetector';

describe('Identifier Scent & Transformation Detection', () => {
  let harness: NetworkHarness;

  beforeAll(async () => {
    harness = await NetworkHarness.bootstrap();
  });

  /**
   * Helper to verify if a file is classified as Logic/Meaningful 
   * due to internal identifier transformation.
   */
  const checkIsLogic = (path: string): boolean => {
    const ast = harness.getAst(path);
    if (!ast) return false;
    return hasLogicActivity(ast);
  };

  it('should detect simple aliasing as Logic Activity (ScentChainB)', () => {
    // ScentChainB: const account = user;
    // The flow analyzer should see the VariableDeclarator with an init value.
    const path = 'packages/web/ScentChainB.ts';
    const ast = harness.getAst(path)!;

    expect(hasLogicActivity(ast)).toBe(true); 
    expect(hasReexports(ast)).toBe(false); // It's a logic junction, not a re-export pipe
  });

  it('should detect destructuring transformations as Logic Activity (ScentChainC)', () => {
    // ScentChainC: const { account: profile } = { account };
    // Pattern: Object Destructuring with Aliasing
    const path = 'packages/web/ScentChainC.ts';
    const ast = harness.getAst(path)!;

    expect(hasLogicActivity(ast)).toBe(true);
  });

  it('should detect identity assignment and side effects (ScentChainD)', () => {
    // ScentChainD: const member = profile; console.log(member.name);
    const path = 'packages/web/ScentChainD.ts';
    const ast = harness.getAst(path)!;

    expect(hasLogicActivity(ast)).toBe(true);
  });

  it('should treat a direct passthrough WITHOUT re-exports as Logic (ScentChainA)', () => {
    // ScentChainA: export const ScentChainA = (user) => ScentChainB(user);
    // Even if it looks like a pipe, it's a function declaration, which is logic.
    // Real pipes MUST use 'export ... from' syntax.
    const path = 'packages/web/ScentChainA.ts';
    const ast = harness.getAst(path)!;

    expect(hasReexports(ast)).toBe(false);
    expect(hasLogicActivity(ast)).toBe(true);
  });

  it('should differentiate between a Scent Transformation and a Pure Pipe', () => {
    const logicPath = 'packages/web/ScentChainB.ts';
    const pipePath = 'packages/ui-kit/components/index.ts';

    const logicAst = harness.getAst(logicPath)!;
    const pipeAst = harness.getAst(pipePath)!;

    // The Scent file "does something" (declares a variable)
    expect(hasLogicActivity(logicAst)).toBe(true);
    
    // The Pipe file ONLY re-exports
    expect(hasReexports(pipeAst)).toBe(true);
    expect(hasLogicActivity(pipeAst)).toBe(false);
  });
});