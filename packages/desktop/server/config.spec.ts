/**
 * @file packages/context-slicer-app/scripts/config.test.ts
 * @stamp {"ts":"2025-10-13T10:03:20.151Z"}
 * @test-target packages/context-slicer-app/scripts/config.ts
 * @description
 * This test suite verifies the core logic of the configuration loader and path
 * derivation engine. It ensures that given a mock configuration file, the script
 * correctly resolves the absolute path to the target project's root and derives
 * the tool's internal paths correctly.
 * @criticality Critical (Reason: I/O & Concurrency Management, Core Business Logic Orchestration)
 * @testing-layer Unit
 * @contract
 *   assertions:
 *     purity: pure # The test suite MUST NOT have side effects.
 *     external_io: none # The test suite MUST NOT perform any network I/O.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock the core Node.js modules
vi.mock('fs');
vi.mock('path');

// Type-safe mocks
const mockedFs = vi.mocked(fs);
const mockedPath = vi.mocked(path);

describe('config', () => {
  beforeEach(() => {
    // Reset mocks before each test to ensure isolation
    vi.resetAllMocks();

    // Setup default path mocks for a Unix-like environment
    mockedPath.join.mockImplementation((...args) => args.join('/'));
    mockedPath.dirname.mockImplementation((p) => p.substring(0, p.lastIndexOf('/')));
  });

  afterEach(() => {
    // Reset module cache to allow re-importing the config module in each test
    vi.resetModules();
  });

  it('should correctly resolve REPO_ROOT and internal paths from a valid config', async () => {
    // Arrange
    const mockConfigYaml = `
      version: 1
      project:
        targetProjectRoot: '../../target-project'
      output:
        beginMarker: 'BEGIN'
        endMarker: 'END'
    `;
    mockedFs.readFileSync.mockReturnValue(mockConfigYaml);

    // Mock path resolution to return predictable absolute paths
    mockedPath.resolve.mockImplementation((...args) => {
      // Mock resolving the Slicer App Root
      if (args.length === 2 && args[1] === '..') {
        return '/slicer-app';
      }
      // Mock resolving the target project's REPO_ROOT
      if (args.length === 2 && args[0].endsWith('/public') && args[1] === '../../target-project') {
        return '/target-project';
      }
      // Fallback for any other resolve calls
      return args.join('/');
    });

    // Act
    const config = await import('./config.ts');

    // Assert
    expect(config.REPO_ROOT).toBe('/target-project');
    expect(config.DUMP_ROOT).toBe('/slicer-app/public/source-dump/_full-dump');
  });

  it('should throw an error if the config file is not found', async () => {
    // Arrange
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error('File not found');
    });
    // Mock the process.exit to prevent the test runner from terminating
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    // Act
    const importPromise = import('./config.ts');

    // Assert
    // We expect the module import itself to fail, which Vitest can catch.
    await expect(importPromise).rejects.toThrow();
    
    // Although the module throws, the top-level error handling catches it
    // and calls process.exit(1). We verify that this mechanism was triggered.
    // Note: Due to how modules are loaded, the test environment might not
    // see the specific error message logged to the console before exit.
    // The critical behavior to test is that an error is thrown and exit is called.
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});