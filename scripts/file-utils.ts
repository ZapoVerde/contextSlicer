/**
 * @file packages/context-slicer-app/scripts/file-utils.ts
 * @architectural-role Utility Module / Filesystem Toolbox
 *
 * @description This module provides a collection of generic, reusable helper functions for interacting with the filesystem. It abstracts away the low-level details of creating directories, hashing files, and creating zip archives.
 *
 * @core-principles
 * 1. **MUST** contain only generic, reusable functions.
 * 2. **MUST NOT** contain any business logic specific to the source dump process (e.g., grouping files, creating manifests).
 * 3. **MUST** import its configuration (`REPO_ROOT`) from `config.ts` to resolve absolute paths.
 * 4. **MUST** import the configured `ignore` instance from `ignore-handler.ts` to correctly filter files during directory traversal.
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { REPO_ROOT } from './config.js';
import ig from './ignore-handler.js';

/**
 * Ensures that a directory exists, creating it recursively if necessary.
 * @param {string} dir - The absolute path to the directory.
 */
export async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

/**
 * Calculates the MD5 hash of a file and returns the first 8 characters.
 * @param {string} filePath - The absolute path to the file.
 * @returns {string} The 8-character MD5 hash.
 */
export function getFileHash(filePath: string): string {
  const fileBuffer: Buffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('md5');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex').slice(0, 8);
}

/**
 * Converts an absolute path to a relative, Unix-style path string from the repo root.
 * @param {string} p - The absolute path.
 * @returns {string} The relative path with forward slashes.
 */
function relUnix(p: string): string {
  return p
    .replace(/\\/g, '/')
    .replace(REPO_ROOT.replace(/\\/g, '/'), '')
    .replace(/^\/+/, '');
}

/**
 * Recursively walks a directory, applying ignore rules and invoking a callback for each entry.
 * @param {string} dir - The absolute path to the directory to start from.
 * @param {(fullPath: string, isDirectory: boolean) => void} onEntry - The callback to invoke for each file/directory.
 */

export function walkDir(dir: string, onEntry: (fullPath: string, isDirectory: boolean) => void): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // Suppress errors for unreadable directories
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink?.()) {
      continue; // Avoid potential cycles via symlinks
    }

    const fullPath: string = path.join(dir, entry.name);
    const relPath: string = relUnix(fullPath);

    // Use the configured ignore instance to filter files
    if (ig.ignores(relPath)) continue;

    onEntry(fullPath, entry.isDirectory());

    if (entry.isDirectory()) {
      walkDir(fullPath, onEntry);
    }
  }
}

/**
 * Creates a zip archive from a list of relative file paths. 
 * @param {string} zipPath - The absolute path where the zip file will be saved.
 * @param {string[]} relPaths - An array of file paths relative to the repo root.
 * @returns {Promise<number>} The size of the created zip file in bytes.
 */
export async function writeZipFromFiles(zipPath: string, relPaths: string[]): Promise<number> {
    // This is a documented exception. The type definitions for AdmZip are not fully
  // compatible with the NodeNext module resolution strategy, causing a false positive
  // error. We cast to 'any' here as a pragmatic escape hatch to create the instance.
  const zip = new (AdmZip as any)();
  for (const rp of relPaths) {
    const abs = path.join(REPO_ROOT, rp);
    zip.addLocalFile(abs, path.dirname(rp));
  }
  await ensureDir(path.dirname(zipPath));
  zip.writeZip(zipPath);
  const stat = await fsp.stat(zipPath);
  return stat.size;
}

/**
 * Reads a binary file, converts it to a base64 string, and writes it to a new file.
 * @param {string} binPath - The absolute path to the binary file to read.
 * @param {string} b64Path - The absolute path where the base64 text file will be saved.
 * @returns {Promise<number>} The length of the created base64 string.
 */
export async function writeBase64File(binPath: string, b64Path: string): Promise<number> {
  const buf: Buffer = await fsp.readFile(binPath);
  const b64: string = buf.toString('base64');
  await ensureDir(path.dirname(b64Path));
  await fsp.writeFile(b64Path, b64, 'utf8');
  return b64.length;
}