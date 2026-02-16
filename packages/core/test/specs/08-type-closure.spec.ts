/**
 * @file packages/core/test/specs/08-type-closure.spec.ts
 * @stamp {"ts":"2026-02-17T00:30:00Z"}
 * @architectural-role Test Suite
 * @description
 * Part 2 of the Split Validation. Focuses exclusively on the "Type Closure" 
 * engine (`typeDefinitionExtractor`). Verifies that the system constructs 
 * valid, self-contained semantic contracts from the raw extracted metadata.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NetworkHarness } from '../harness/network-harness.js';
import { generateBoundaryLibrary } from '../../src/logic/symbolGraph/typeDefinitionExtractor.js';

describe('Layer 1.5: Type Closure (The Distiller)', () => {
  let harness: NetworkHarness;

  beforeAll(async () => {
    // The harness runs the "Omniscient Miner" on all files during bootstrap
    harness = await NetworkHarness.bootstrap();
  });

  /**
   * Helper to simulate a request for a specific boundary symbol.
   */
  const requestSymbol = async (identifier: string, sourcePath: string) => {
    const typeLib = harness.getTypeLib();
    const signLib = harness.getSignLib();
    
    return generateBoundaryLibrary(
      [{ identifier, sourcePath }],
      typeLib,
      signLib
    );
  };

  it('should generate synthetic signatures for values (Components)', async () => {
    // Dashboard.tsx: export const Dashboard = () => 'dashboard';
    const output = await requestSymbol('Dashboard', 'packages/web/Dashboard.tsx');

    // 1. Signature exists
    expect(output).toContain('export declare const Dashboard');
    
    // 2. Implementation is stripped
    expect(output).not.toContain("return 'dashboard'");
  });

  it('should extract full source code for interfaces', async () => {
    // oldTypes.ts: export interface LegacyUser { ... }
    const output = await requestSymbol('LegacyUser', 'packages/legacy/oldTypes.ts');

    expect(output).toContain('interface LegacyUser');
    expect(output).toContain('oldId: number');
  });

  it('should discover and include PRIVATE types used in signatures (Omniscient Mining)', async () => {
    // userService.ts:
    //   interface UserInternalConfig { ... }  <-- Private
    //   export function getUser(config: UserInternalConfig) ...
    const output = await requestSymbol('getUser', 'packages/web/userService.ts');

    // 1. The public function signature
    expect(output).toContain('export declare function getUser');

    // 2. The private type it depends on (The fix from fileAnalyzer.ts)
    expect(output).toContain('interface UserInternalConfig');
    expect(output).toContain('retries: number');
  });

  it('should recursively chase type inheritance chains', async () => {
    // inheritance.ts: SuperAdmin extends Admin extends User
    const output = await requestSymbol('SuperAdmin', 'packages/shared-types/inheritance.ts');

    // It should contain the requested symbol
    expect(output).toContain('interface SuperAdmin');

    // AND its dependencies (The Local Chaser)
    expect(output).toContain('interface Admin');
    expect(output).toContain('interface User');
    expect(output).toContain('interface Entity');
  });

  it('should handle complex generic types without truncation', async () => {
    // generics.ts: export type AsyncState<T> = { ... }
    const output = await requestSymbol('AsyncState', 'packages/shared-types/generics.ts');

    expect(output).toContain('type AsyncState<T>');
    expect(output).toContain('data: T | null');
    expect(output).toContain('loading: boolean');
  });
});