/**
 * @file packages/context-slicer-app/scripts/build-step-clean.ts
 * @architectural-role Build Step / Utility
 *
 * @description This module is responsible for cleaning the output directory of any artifacts from a previous build. It ensures that each run starts with a clean slate, preventing stale files from being served.
 *
 * @core-principles
 * 1. **MUST** contain only logic related to deleting old build artifacts.
 * 2. **MUST** robustly handle cases where the directories it tries to delete do not exist (e.g., on the very first run).
 * 3. **MUST** import all necessary paths from the `config.ts` module.
 */

import fsp from 'fs/promises';
import path from 'path';
import * as config from './config.ts';
import { ensureDir } from './file-utils.ts';

/**
 * Removes previously generated dump artifacts to ensure a clean build.
 * This includes hashed-named concat files and the entire 'folders' directory.
 */
export async function cleanOldArtifacts(): Promise<void> {
  try {
    // Ensure the main dump directory exists before trying to read from or delete within it.
    await ensureDir(config.DUMP_ROOT);

    // Delete old top-level, hashed artifacts (e.g., source-dump.<hash>.txt/zip).
    const filesInDumpRoot: string[] = await fsp.readdir(config.DUMP_ROOT);
    for (const file of filesInDumpRoot) {
      if (file.startsWith('source-dump.') && (file.endsWith('.zip') || file.endsWith('.txt'))) {
        await fsp.unlink(path.join(config.DUMP_ROOT, file));
      }
    }

    // Also delete the manifest file if it exists.
    const manifestPath: string = path.join(config.DUMP_ROOT, 'dumpPaths.json');
    try {
      await fsp.unlink(manifestPath);
    } catch (err: unknown) {
      const error = err as { code?: string };
      // Ignore if the manifest doesn't exist, which is a valid state.
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    // Recursively and forcefully remove the entire directory for grouped artifacts.
    // This is simpler and more effective than deleting its contents file by file.
    await fsp.rm(config.FOLDERS_DIR, { recursive: true, force: true });

  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}