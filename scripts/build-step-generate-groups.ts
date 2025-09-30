/**
 * @file packages/context-slicer-app/scripts/build-step-generate-groups.ts
 * @architectural-role Build Step / Artifact Generator
 *
 * @description This module is responsible for generating the per-folder (or "group") artifacts. For each directory identified in the source code, it creates a concatenated text file, a zip archive, and a base64-encoded version of the zip archive. It returns a metadata array describing these generated files, which is essential for building the final manifest.
 *
 * @core-principles
 * 1. **MUST** accept a map of grouped files as its primary input.
 * 2. **MUST** iterate through each group and generate three distinct artifacts: `.txt`, `.zip`, and `.b64.txt`.
 * 3. **MUST** use utilities from `file-utils.ts` for filesystem operations like writing zip files.
 * 4. **MUST** calculate and return a structured array of metadata (`groupsMeta`) for use in the final manifest.
 * 5. **MUST** ensure all generated artifacts are placed in the correct `FOLDERS_DIR` as defined in `config.ts`.
 */

import fsp from 'fs/promises';
import path from 'path';
import * as config from './config.ts';
import * as utils from './file-utils.ts';
import type { SourceFile } from './build-step-collect-files.ts';

// Define a clear type for the metadata object returned by this module.
export interface GroupMetadata {
  txtUrl: string;
  zipUrl: string;
  b64Url: string;
  name: string;
  originalPath: string;
  fileCount: number;
  bytes: number;
  zipBytes: number;
  b64Bytes: number;
}

/**
 * Creates a web-safe filename from a display name by replacing invalid characters.
 * @param {string} displayName - The original folder path or group name.
 * @returns {string} A string safe for use as a filename.
 */
function safeNameFromGroup(displayName: string): string {
  // Allow letters, digits, dot, dash, space, parens, underscore. Replace others.
  return displayName.replace(/[^\w.\- ()]/g, '_');
}

/**
 * Generates all per-folder artifacts (.txt, .zip, .b64.txt) for each group of files.
 * @param {Map<string, SourceFile[]>} groupedFiles - A map of folder paths to file arrays.
 * @returns {Promise<GroupMetadata[]>} A promise that resolves to the `groupsMeta` array for the manifest.
 */
export async function generateGroupArtifacts(groupedFiles: Map<string, SourceFile[]>): Promise<GroupMetadata[]> {
  // Ensure the parent directory for all group artifacts exists.
  await utils.ensureDir(config.FOLDERS_DIR);

  const groupsMeta: GroupMetadata[] = [];

  for (const [folderPath, filesInGroup] of groupedFiles.entries()) {
    const originalPath: string = folderPath || '';

    const displayName: string = originalPath || '(repo root)';
    const safe: string = safeNameFromGroup(displayName);

    // Define the absolute paths for the three artifacts this group will produce.
    const txtPath: string = path.join(config.FOLDERS_DIR, `${safe}.txt`);
    const zipPath: string = path.join(config.FOLDERS_DIR, `${safe}.zip`);
    const b64Path: string = path.join(config.FOLDERS_DIR, `${safe}.b64.txt`);

    // --- Generate the concatenated .txt file for the group ---
    const chunks: string[] = [];
    chunks.push(`# Group: ${displayName}`);
    chunks.push(`# Files: ${filesInGroup.length}`);
    chunks.push('');

    for (const { path: relativeFilePath } of filesInGroup) {
      const absoluteFilePath: string = path.join(config.REPO_ROOT, relativeFilePath);
      try {
        const content: string = await fsp.readFile(absoluteFilePath, 'utf8');
        chunks.push(`${config.BEGIN_SIG}${relativeFilePath}`);
        chunks.push(content);
        chunks.push(config.END_SIG);
        chunks.push('');
      } catch {
        // Handle binary files by base64 encoding them within the text file.
        const buf: Buffer = await fsp.readFile(absoluteFilePath);
        chunks.push(`${config.BEGIN_SIG}${relativeFilePath}`);
        chunks.push('[[BINARY FILE, BASE64 ENCODED]]');
        chunks.push(buf.toString('base64'));
        chunks.push(config.END_SIG);
        chunks.push('');
      }
    }
    await fsp.writeFile(txtPath, chunks.join('\n'), 'utf8');

    // --- Generate the .zip and .b64.txt files for the group ---
    const relativeFilePaths: string[] = filesInGroup.map(f => f.path);
    const zipBytes: number = await utils.writeZipFromFiles(zipPath, relativeFilePaths);
    const b64Bytes: number = await utils.writeBase64File(zipPath, b64Path);

    // --- Construct public URLs and metadata for the manifest ---
    const safeEnc: string = encodeURIComponent(safe);
    const txtUrl: string = `${config.FOLDERS_BASE_URL}/${safeEnc}.txt`;
    const zipUrl: string = `${config.FOLDERS_BASE_URL}/${safeEnc}.zip`;
    const b64Url: string = `${config.FOLDERS_BASE_URL}/${safeEnc}.b64.txt`;

    groupsMeta.push({
      txtUrl,
      zipUrl,
      b64Url,
      name: safe,
      originalPath,
      fileCount: filesInGroup.length,
      bytes: filesInGroup.reduce((acc, file) => acc + (file.bytes || 0), 0),
      zipBytes,
      b64Bytes,
    });
  }

  // Sort the metadata alphabetically by the original folder path for a consistent manifest.
  groupsMeta.sort((a, b) => (a.originalPath || '').localeCompare(b.originalPath || ''));

  return groupsMeta;
}