/**
 * @file packages/core/test/specs/04-boundary-detection.spec.ts
 * @stamp {"ts":"2026-02-17T00:25:00Z"}
 * @architectural-role Test Suite
 * @description
 * Part 1 of the Split Validation. Focuses exclusively on the "Boundary Scanner" 
 * engine. Verifies that the system correctly identifies symbols that cross 
 * from selected files into non-selected files (Context Leaks).
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NetworkHarness } from '../harness/network-harness.js';
import { scanBoundaries } from '../../src/logic/symbolGraph/boundaryScanner/index.js';
import type { SelectedFileMap } from '../../src/logic/symbolGraph/boundaryScanner/types.js';

describe('Layer 1.5: Boundary Detection (The Scanner)', () => {
  let harness: NetworkHarness;

  const TEST_ALIASES = {
    '@prism/shared-types': 'packages/shared-types',
    '@prism/ui-kit': 'packages/ui-kit',
    '@prism/web': 'packages/web'
  };

  beforeAll(async () => {
    harness = await NetworkHarness.bootstrap();
  });

  it('should detect a Value-level leak (Component Import)', () => {
    const fileIndex = harness.getFileIndex();
    
    // Entry2.tsx imports { Dashboard } from './Dashboard'
    const entryPath = 'packages/web/Entry2.tsx';
    const selectedFiles: SelectedFileMap = new Map();
    selectedFiles.set(entryPath, harness.getAst(entryPath)!);

    const boundarySymbols = scanBoundaries(fileIndex, selectedFiles, TEST_ALIASES);
    
    const leak = boundarySymbols.find(s => s.identifier === 'Dashboard');
    expect(leak).toBeDefined();
    expect(leak?.sourcePath).toBe('packages/web/Dashboard.tsx');
  });

  it('should detect a Type-level leak (Interface Import)', () => {
    const fileIndex = harness.getFileIndex();

    // adapter.ts imports { LegacyUser } from '../legacy/oldTypes'
    const adapterPath = 'packages/web/adapter.ts';
    const selectedFiles: SelectedFileMap = new Map();
    selectedFiles.set(adapterPath, harness.getAst(adapterPath)!);

    const boundarySymbols = scanBoundaries(fileIndex, selectedFiles, TEST_ALIASES);

    const leak = boundarySymbols.find(s => s.identifier === 'LegacyUser');
    expect(leak).toBeDefined();
    expect(leak?.sourcePath).toBe('packages/legacy/oldTypes.ts');
  });

  it('should correctly resolve boundaries across monorepo aliases', () => {
    const fileIndex = harness.getFileIndex();

    // App.tsx imports { SuperAdmin } from '@prism/shared-types/inheritance'
    const appPath = 'packages/web/App.tsx';
    const selectedFiles: SelectedFileMap = new Map();
    selectedFiles.set(appPath, harness.getAst(appPath)!);

    const boundarySymbols = scanBoundaries(fileIndex, selectedFiles, TEST_ALIASES);
    
    const leak = boundarySymbols.find(s => s.identifier === 'SuperAdmin');
    expect(leak).toBeDefined();
    expect(leak?.sourcePath).toBe('packages/shared-types/inheritance.ts');
  });

  it('should NOT report symbols if the source file is included in the pack', () => {
    const fileIndex = harness.getFileIndex();

    // If both Entry2.tsx AND Dashboard.tsx are selected, there is no boundary crossing.
    const entryPath = 'packages/web/Entry2.tsx';
    const dashPath = 'packages/web/Dashboard.tsx';
    
    const selectedFiles: SelectedFileMap = new Map();
    selectedFiles.set(entryPath, harness.getAst(entryPath)!);
    selectedFiles.set(dashPath, harness.getAst(dashPath)!);

    const boundarySymbols = scanBoundaries(fileIndex, selectedFiles, TEST_ALIASES);
    
    const leak = boundarySymbols.find(s => s.identifier === 'Dashboard');
    expect(leak).toBeUndefined(); // Should be internal, not boundary
  });
});