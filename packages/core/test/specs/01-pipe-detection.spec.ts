/**
 * @file packages/core/test/specs/01-pipe-detection.spec.ts
 * @stamp {"ts":"2026-02-15T20:30:00Z"}
 * @architectural-role Test Suite
 * @description
 * Validates the "Two-Part Pipe Detection Rule" against the Hardened Prism Network.
 * Verifies the distinction between structural passthroughs (Pipes) and 
 * logic-bearing junctions (Logic), ensuring architectural integrity in 
 * hop-count calculations.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NetworkHarness } from '../harness/network-harness';
import { hasReexports } from '../../src/logic/symbolGraph/analyzers/barrelDetector';
import { hasLogicActivity } from '../../src/logic/symbolGraph/analyzers/flowAnalyzer';

describe('Two-Part Pipe Detection Rule', () => {
  let harness: NetworkHarness;

  /**
   * Helper to verify the combined Pipe Detection logic used by the tracer.
   * Pipe = (Has Re-exports) AND (Has NO Logic Activity)
   */
  const checkIsPipe = (path: string): boolean => {
    const ast = harness.getAst(path);
    if (!ast) return false;
    return hasReexports(ast) && !hasLogicActivity(ast);
  };

  beforeAll(async () => {
    harness = await NetworkHarness.bootstrap();
  });

  describe('Section 1: Pure Pipes (Passthroughs)', () => {
    it('should classify packages/ui-kit/components/index.ts as a Pipe', () => {
      // This is a pure barrel exporting sub-folders
      expect(checkIsPipe('packages/ui-kit/components/index.ts')).toBe(true);
    });

    it('should classify packages/ui-kit/components/buttons/index.ts as a Pipe', () => {
      // Simple nested barrel
      expect(checkIsPipe('packages/ui-kit/components/buttons/index.ts')).toBe(true);
    });

    it('should classify packages/ui-kit/placeholder.ts as NOT a pipe (No exports)', () => {
      // Empty file with export {} has no re-exports
      expect(checkIsPipe('packages/ui-kit/placeholder.ts')).toBe(false);
    });
  });

  describe('Section 2: False Pipes (Logic-Bearing)', () => {
    it('should classify packages/ui-kit/index.ts as LOGIC due to side effects', () => {
      // Contains a console.log and conditional check
      const ast = harness.getAst('packages/ui-kit/index.ts')!;
      expect(hasReexports(ast)).toBe(true);
      expect(hasLogicActivity(ast)).toBe(true); // Violation: Side effect
      expect(checkIsPipe('packages/ui-kit/index.ts')).toBe(false);
    });

    it('should classify packages/web/FalsePipe.tsx as LOGIC due to hooks', () => {
      // Contains re-exports AND a useEffect hook
      const ast = harness.getAst('packages/web/FalsePipe.tsx')!;
      expect(hasReexports(ast)).toBe(true);
      expect(hasLogicActivity(ast)).toBe(true); // Violation: useEffect
      expect(checkIsPipe('packages/web/FalsePipe.tsx')).toBe(false);
    });

    it('should classify packages/web/PropDriller.tsx as LOGIC due to composition', () => {
      // React pattern: passes props to children. NOT a pipe.
      const ast = harness.getAst('packages/web/PropDriller.tsx')!;
      // It has no re-exports (it imports and then renders)
      expect(hasReexports(ast)).toBe(false);
      expect(hasLogicActivity(ast)).toBe(true); // Violation: JSX/Composition
      expect(checkIsPipe('packages/web/PropDriller.tsx')).toBe(false);
    });

    it('should classify packages/ui-kit/button/index.ts as LOGIC due to type narrowing', () => {
      // Re-exports but also defines a new type 'StrictButton'
      const ast = harness.getAst('packages/ui-kit/button/index.ts')!;
      expect(hasReexports(ast)).toBe(true);
      expect(hasLogicActivity(ast)).toBe(true); // Violation: Internal declaration
      expect(checkIsPipe('packages/ui-kit/button/index.ts')).toBe(false);
    });

    it('should classify packages/ui-kit/Hybrid.ts as LOGIC due to internal usage', () => {
      // Re-exports Button but also calls it locally in PrimaryButton
      const ast = harness.getAst('packages/ui-kit/Hybrid.ts')!;
      expect(hasReexports(ast)).toBe(true);
      expect(hasLogicActivity(ast)).toBe(true); // Violation: Local function using symbol
      expect(checkIsPipe('packages/ui-kit/Hybrid.ts')).toBe(false);
    });
  });
});