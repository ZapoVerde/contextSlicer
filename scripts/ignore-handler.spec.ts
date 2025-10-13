/**
 * @file packages/context-slicer-app/scripts/ignore-handler.test.ts
 * @stamp {"ts":"2025-10-13T10:05:40.835Z"}
 * @test-target packages/context-slicer-app/scripts/ignore-handler.ts
 * @description
 * This test suite verifies that the ignore handler correctly creates the dynamic,
 * self-referential exclusion rule for the tool's output directory. It will mock
 * the filesystem and the config to ensure the final ignore instance correctly
 * filters out the path to the dump directory.
 * @criticality Critical (Reason: Core Business Logic Orchestration)
 * @testing-layer Unit
 * @contract
 *   assertions:
 *     purity: pure # The test suite MUST NOT have side effects.
 *     external_io: none # The test suite MUST NOT perform any network I/O.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';

// Mock the dependencies of the ignore-handler module
vi.mock('fs');
vi.mock('./config.js');

describe('ignore-handler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should programmatically ignore the DUMP_ROOT directory', async () => {
    // Arrange
    // 1. Mock the filesystem to simulate a project with no .gitignore files
    const mockedFs = vi.mocked(fs);
    mockedFs.readFileSync.mockReturnValue('');
    mockedFs.readdirSync.mockReturnValue([]);

    // 2. Mock the config module to provide predictable paths and empty rule sets
    vi.mock('./config.js', () => ({
      REPO_ROOT: '/project',
      DUMP_ROOT: '/project/slicer-tool/public/source-dump/_full-dump',
      slicerConfig: {
        sanitation: {
          denyPatterns: [],
        },
        sanitationOverrides: {
          mandatoryInclusions: [],
        },
      },
    }));

    // Act
    // Dynamically import the ignore-handler to execute its logic with our mocks
    const ig = (await import('./ignore-handler.js')).default;

    // Assert
    const ignoredPath = 'slicer-tool/public/source-dump/_full-dump/some-artifact.zip';
    const validPath = 'src/index.ts';

    expect(ig.ignores(ignoredPath)).toBe(true);
    expect(ig.ignores(validPath)).toBe(false);
  });
});