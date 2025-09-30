/**
 * @file packages/context-slicer-app/scripts/build-step-generate-final-zip.ts
 * @stamp {"ts":"2025-09-29T00:08:45Z"}
 * @architectural-role Build Step / Finalizer
 *
 * @description
 * This module performs the final steps of the build process. It is responsible
 * for assembling the complete `dumpPaths.json` manifest, which now includes
 * the dynamically discovered alias map. It then creates the final, self-contained
 * zip archive (`source-dump.<hash>.zip`) which includes all source files PLUS
 * the manifest itself. After hashing the final zip for cache-busting, it
 * writes the definitive manifest to the output directory.
 *
 * @core-principles
 * 1.  IT MUST BE THE FINAL AUTHORITY ON THE MANIFEST: This module is responsible
 *     for creating the definitive `dumpPaths.json` file. It MUST correctly
 *     incorporate all data from previous build steps (file lists, group metadata,
 *     and the monorepo alias map) into a single, cohesive manifest object.
 *
 * 2.  THE GENERATED ZIP MUST BE SELF-CONTAINED: The final zip archive it creates
 *     MUST include its own manifest file (`dumpPaths.json`) at its root. This
 *     ensures that a downloaded zip is a complete, portable artifact that
 *     contains all the metadata needed to understand its own contents.
 *
 * 3.  IT MUST HASH FOR CACHING: It MUST correctly hash the final zip file to
 *     generate its unique, cache-busting filename and update the manifest with
 *     this final name before writing it to disk.
 */

import fsp from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import * as config from './config.ts';
import * as utils from './file-utils.ts';
import type { SourceFile } from './build-step-collect-files.ts';
import type { GroupMetadata } from './build-step-generate-groups.ts';

// --- Update data interfaces for aliasMap ---
// Define the shape of the data this function expects.
interface BuildData {
  collectedFiles: SourceFile[];
  groupsMeta: GroupMetadata[];
  finalConcatTxtUrl: string;
  aliasMap: Record<string, string>; // Add aliasMap here
}

// Define the shape of the final manifest object.
export interface Manifest {
  generatedAt: string;
  dumpBase: string;
  concatTxt: string;
  concatZip: string;
  foldersBase: string;
  groups: GroupMetadata[];
  aliasMap: Record<string, string>; // And also here
}

/**
 * Creates the final zip archive and the `dumpPaths.json` manifest.
 * @param {BuildData} buildData - The data collected from previous build steps.
 * @returns {Promise<Manifest>} A promise that resolves to the final, complete manifest object.
 */
export async function generateFinalZipAndManifest({
  collectedFiles,
  groupsMeta,
  finalConcatTxtUrl,
  aliasMap, // Destructure the new aliasMap
}: BuildData): Promise<Manifest> {
  // 1. Create the initial manifest object in memory.
  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    dumpBase: config.DUMP_BASE_URL,
    concatTxt: finalConcatTxtUrl,
    concatZip: '', // To be filled in later.
    foldersBase: config.FOLDERS_BASE_URL,
    groups: groupsMeta,
    aliasMap: aliasMap, // --- START OF CHANGE: Add aliasMap to the manifest ---
  };

  // 2. Create the final, self-contained zip archive.
  const zip = new AdmZip();

  // Add all collected source files to the zip.
  for (const { path: relPath } of collectedFiles) {
    const absPath: string = path.join(config.REPO_ROOT, relPath);
    zip.addLocalFile(absPath, path.dirname(relPath));
  }

  // Add the manifest as a new file directly into the root of the zip archive.
  zip.addFile('dumpPaths.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

  // 3. Write the complete zip to a temporary path so we can hash it.
  await utils.ensureDir(path.dirname(config.CONCAT_ZIP_PATH));
  zip.writeZip(config.CONCAT_ZIP_PATH);

  // 4. Hash the final zip and determine its final name and path.
  const hash: string = utils.getFileHash(config.CONCAT_ZIP_PATH);
  const finalConcatZipUrl: string = `source-dump.${hash}.zip`;
  const finalPath: string = path.join(config.DUMP_ROOT, finalConcatZipUrl);

  // Rename the temporary zip file to its final, hashed name.
  await fsp.rename(config.CONCAT_ZIP_PATH, finalPath);

  // 5. Now that we have the final zip URL, update the manifest object.
  manifest.concatZip = finalConcatZipUrl;

  // 6. Write the final, completed manifest to disk as a standalone file.
  await fsp.writeFile(
    path.join(config.DUMP_ROOT, 'dumpPaths.json'),
    JSON.stringify(manifest, null, 2)
  );

  // 7. Return the completed manifest for the orchestrator to log.
  return manifest;
}