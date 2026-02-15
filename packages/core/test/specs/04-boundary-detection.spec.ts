/**
 * @file packages/core/test/specs/04-boundary-detection.spec.ts
 * @stamp {"ts":"2026-02-15T22:15:00Z"}
 * @architectural-role Test Suite
 * @description
 * Validates the Project Boundary Library (Layer 1.5) extraction engine.
 * Verifies that imports crossing the pack boundary are detected and their 
 * definitions extracted, even when the source files are explicitly excluded.
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { NetworkHarness } from '../harness/network-harness';
import { scanBoundaries } from '../../src/logic/symbolGraph/boundaryScanner';
import { generateBoundaryLibrary } from '../../src/logic/symbolGraph/typeDefinitionExtractor';
import type { SelectedFileMap } from '../../src/logic/symbolGraph/boundaryScanner/types';

describe('Boundary Detection & Type Extraction', () => {
  let harness: NetworkHarness;

  beforeAll(async () => {
    harness = await NetworkHarness.bootstrap();
  });

  it('should detect the "Boundary Paradox": Extracting types from excluded directories', async () => {
    const fileIndex = harness.getFileIndex();
    
    // SETUP: We select 'adapter.ts' but NOT its dependency 'oldTypes.ts' (The Paradox)
    const adapterPath = 'packages/web/adapter.ts';
    const legacyPath = 'packages/legacy/oldTypes.ts';
    
    const selectedFiles: SelectedFileMap = new Map();
    selectedFiles.set(adapterPath, harness.getAst(adapterPath)!);

    // 1. Scan Boundaries
    const boundarySymbols = scanBoundaries(fileIndex, selectedFiles);
    
    // Verify LegacyUser was detected
    const legacyUser = boundarySymbols.find(s => s.identifier === 'LegacyUser');
    expect(legacyUser).toBeDefined();
    expect(legacyUser?.sourcePath).toBe(legacyPath);

    // 2. Generate Library
    const library = await generateBoundaryLibrary(fileIndex, boundarySymbols);
    
    // Verify the content contains the raw interface definition
    expect(library).toContain('interface LegacyUser');
    expect(library).toContain('oldId: number');
    expect(library).toContain('username: string');
  });

  it('should resolve monorepo aliases (@prism/*) during boundary scanning', () => {
    const fileIndex = harness.getFileIndex();
    const appPath = 'packages/web/App.tsx';
    
    const selectedFiles: SelectedFileMap = new Map();
    selectedFiles.set(appPath, harness.getAst(appPath)!);

    const boundarySymbols = scanBoundaries(fileIndex, selectedFiles);

    // App.tsx imports SuperAdmin from '@prism/shared-types/inheritance'
    const superAdmin = boundarySymbols.find(s => s.identifier === 'SuperAdmin');
    expect(superAdmin).toBeDefined();
    expect(superAdmin?.sourcePath).toBe('packages/shared-types/inheritance.ts');
  });

  it('should detect and extract definitions from "import type" statements', async () => {
    const fileIndex = harness.getFileIndex();
    const typeOnlyPath = 'packages/web/TypeOnly.ts';
    
    const selectedFiles: SelectedFileMap = new Map();
    selectedFiles.set(typeOnlyPath, harness.getAst(typeOnlyPath)!);

    const boundarySymbols = scanBoundaries(fileIndex, selectedFiles);

    // TypeOnly.ts uses: import type { User } from '../shared-types/inheritance'
    const userType = boundarySymbols.find(s => s.identifier === 'User');
    expect(userType).toBeDefined();
    expect(userType?.sourcePath).toBe('packages/shared-types/inheritance.ts');

    const library = await generateBoundaryLibrary(fileIndex, boundarySymbols);
    expect(library).toContain('interface User extends Entity');
  });

  it('should extract complex TypeScript structures (Enums and Namespaces)', async () => {
    const fileIndex = harness.getFileIndex();
    
    // Mocking a boundary crossing for enums
    const boundarySymbols = [
      { identifier: 'Role', sourcePath: 'packages/shared-types/enums.ts' },
      { identifier: 'API', sourcePath: 'packages/shared-types/enums.ts' }
    ];

    const library = await generateBoundaryLibrary(fileIndex, boundarySymbols);

    // Verify Enum extraction
    expect(library).toContain('enum Role');
    expect(library).toContain("Admin = 'ADMIN'");

    // Verify Namespace extraction
    expect(library).toContain('namespace API');
    expect(library).toContain('interface Config');
  });

  it('should ignore external library imports (React, @mui)', () => {
    const fileIndex = harness.getFileIndex();
    const appPath = 'packages/web/App.tsx';
    
    const selectedFiles: SelectedFileMap = new Map();
    selectedFiles.set(appPath, harness.getAst(appPath)!);

    const boundarySymbols = scanBoundaries(fileIndex, selectedFiles);

    // These should NOT be present in the boundary symbols
    const reactImport = boundarySymbols.find(s => s.sourcePath.includes('react'));
    const muiImport = boundarySymbols.find(s => s.sourcePath.includes('@mui'));

    expect(reactImport).toBeUndefined();
    expect(muiImport).toBeUndefined();
  });
});