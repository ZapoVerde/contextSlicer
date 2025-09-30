/**
 * @file packages/context-slicer-app/scripts/generate-dump.ts
 * @stamp {"ts":"2025-09-29T00:07:10Z"}
 * @architectural-role Orchestrator / Entry Point
 *
 * @description
 * This is the main script that orchestrates the entire source dump generation
 * process. It defines the high-level sequence of build steps and delegates the
 * implementation of each step to specialized modules. It is responsible for
 * everything from cleaning old artifacts to discovering the project structure and
 * generating the final, self-contained zip package. It also handles the
 * command-line interface for running one-shot builds or starting in watch mode.
 *
 * @core-principles
 * 1.  IT IS THE PRIMARY ENTRY POINT: This is the definitive starting point for the
 *     entire build process.
 *
 * 2.  IT MUST BE SELF-CONFIGURING: The script MUST discover the project's
 *     structure (like monorepo aliases) by reading the project's own
 *     source-of-truth files (e.g., `pnpm-workspace.yaml`, `package.json`), not
 *     from hardcoded values.
 *
 * 3.  IT MUST ORCHESTRATE, NOT IMPLEMENT: Its primary role is to define the
 *     high-level build sequence within the `buildOnce()` function, calling each
 *     step in the correct order. It delegates all low-level implementation details
 *     for generating artifacts to imported, specialized modules.
 *
 * 4.  IT MUST HANDLE THE CLI: It is responsible for parsing command-line
 *     arguments (like `--watch`) and setting up the file watcher.
 */

import path from 'path';
import fs from 'fs';
import chokidar from 'chokidar';
import * as config from './config.ts';
import ig from './ignore-handler.ts';
import yaml from 'js-yaml';

// Import the typed build step modules.
import { cleanOldArtifacts } from './build-step-clean.ts';
import { collectSourceFiles, groupFilesByFolder, type SourceFile } from './build-step-collect-files.ts';
import { generateGroupArtifacts, type GroupMetadata } from './build-step-generate-groups.ts';
import { generateConcatTxt } from './build-step-generate-concat-txt.ts';
import { generateFinalZipAndManifest, type Manifest } from './build-step-generate-final-zip.ts';

// --- START OF DYNAMIC ALIAS DISCOVERY ---
/**
 * Discovers monorepo package aliases by reading pnpm-workspace.yaml and
 * the corresponding package.json files.
 * @param repoRoot The absolute path to the repository root.
 * @returns A map of package names to their source directories.
 */
function discoverAliases(repoRoot: string): Record<string, string> {
  const aliasMap: Record<string, string> = {};
  const workspacePath = path.join(repoRoot, 'pnpm-workspace.yaml');

  try {
    if (fs.existsSync(workspacePath)) {
      const workspaceConfig = yaml.load(fs.readFileSync(workspacePath, 'utf8')) as { packages?: string[] };
      const packageGlobs = workspaceConfig.packages || [];

      for (const globPattern of packageGlobs) {
        // This is a simple glob handler for patterns like 'packages/*'
        if (globPattern.endsWith('/*')) {
          const packageDir = path.join(repoRoot, globPattern.replace('/*', ''));
          if (fs.existsSync(packageDir)) {
            const packageNames = fs.readdirSync(packageDir, { withFileTypes: true })
              .filter(dirent => dirent.isDirectory())
              .map(dirent => dirent.name);

            for (const pkgName of packageNames) {
              const pkgJsonPath = path.join(packageDir, pkgName, 'package.json');
              if (fs.existsSync(pkgJsonPath)) {
                const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
                const alias = pkgJson.name;
                // Assume source is in 'src'. A more robust solution might check tsconfig.json's 'rootDir'
                const aliasPath = path.join(path.dirname(globPattern), pkgName, 'src').replace(/\\/g, '/');
                if (alias) {
                  aliasMap[alias] = aliasPath;
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn('[dump-src] Warning: Could not discover aliases.', error);
  }
  return aliasMap;
}
// --- END OF DYNAMIC ALIAS DISCOVERY ---

let isBuilding = false;

async function buildOnce(): Promise<void> {
  if (isBuilding) {
    return;
  }
  isBuilding = true;

  console.log('[dump-src] Starting build...');
  try {
    // 1. Clean previous output
    await cleanOldArtifacts();

    // 2. Discover monorepo aliases to be injected into the manifest
    const aliasMap = discoverAliases(config.REPO_ROOT);

    // 3. Discover all relevant source files
    const collectedFiles: SourceFile[] = collectSourceFiles();

    const groupedFiles: Map<string, SourceFile[]> = groupFilesByFolder(collectedFiles);

    // 4. Generate artifacts for each folder group (.txt, .zip, .b64.txt)
    const groupsMeta: GroupMetadata[] = await generateGroupArtifacts(groupedFiles);

    // 5. Generate the single concatenated text file with a hashed name
    const finalConcatTxtUrl: string = await generateConcatTxt(collectedFiles);

    // --- Pass aliasMap to the final step ---
    // 6. Generate the final manifest and the self-contained zip archive
    const finalManifest: Manifest = await generateFinalZipAndManifest({
      collectedFiles,
      groupsMeta,
      finalConcatTxtUrl,
      aliasMap, // Pass the discovered aliases to be written into the manifest
    });
    
    // 7. Log a summary of the generated artifacts
    console.log(`[dump-src] OK ${new Date().toLocaleTimeString()}`);
    console.log(`  Base URL:   ${finalManifest.dumpBase}`);
    console.log(`  Concat TXT: ${finalManifest.dumpBase}/${finalManifest.concatTxt}`);
    console.log(`  Concat ZIP: ${finalManifest.dumpBase}/${finalManifest.concatZip}`);
    console.log(`  Aliases:    ${Object.keys(finalManifest.aliasMap || {}).length} found`);
    console.log(`  Groups:     ${finalManifest.groups.length}`);
  } catch (err: unknown) {
    console.error('[dump-src] Build failed:', err);
    if (!process.argv.includes('--watch')) {
      process.exit(1);
    }
  } finally {
    isBuilding = false;
  }
}

/**
 * Debounce helper to avoid burst rebuilds in watch mode.
 */
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms = 250): (...args: Parameters<T>) => void {
  let t: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      t = null;
      fn(...args);
    }, ms);
  };
}

/**
 * Checks if a path should be ignored by the watcher.
 */
function watcherIgnored(p: string): boolean {
  try {
    const rel: string = path.relative(config.REPO_ROOT, p).replace(/\\/g, '/');
    return ig?.ignores ? ig.ignores(rel) : false;
  } catch {
    return false;
  }
}

// ----------------------------- Entrypoint -----------------------------
if (process.argv.includes('--watch')) {
  const run = debounce(() => {
    buildOnce();
  }, 3000);

  chokidar
    .watch(config.REPO_ROOT, { ignoreInitial: true, ignored: watcherIgnored })
    .on('all', (event: string, p: string) => {
      console.log(`[dump-src] Change detected: ${p}`);
      run();
    });
} else {
  buildOnce();
}