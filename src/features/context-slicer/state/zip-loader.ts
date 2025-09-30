// packages/context-slicer-app/src/features/context-slicer/state/zip-loader.ts

/**
 * @file packages/context-slicer-app/src/features/context-slicer/state/zip-loader.ts
 * @architectural-role State Management / Store Slice / Data Loading & Sanitation
 *
 * @description
 * This module encapsulates the data loading, parsing, and sanitation logic for
 * the store. It is responsible for applying the client-side sanitation pipeline
 * to user-uploaded zip files by importing rules from the shared, browser-safe
 * sanitation config.
 */

import type { StateCreator } from 'zustand';
import JSZip from 'jszip';
import ignore from 'ignore';
import type { ZipState, FileEntry, DumpManifest, SanitationReport, SkippedFile } from './zip-state';
// --- START OF CHANGE: Import rules from the new, browser-safe shared config ---
import { EXPLICIT_DENY_PATTERNS, ACCEPTED_FILE_EXTENSIONS } from '../config/sanitation.config';
// --- END OF CHANGE ---

/**
 * Processes a zip file buffer, applying a sanitation pipeline to filter out
 * unwanted files before adding them to the file index.
 * @param buffer The ArrayBuffer of the zip file.
 * @returns A promise that resolves to an object containing the zip instance,
 *          the sanitized file index, and a detailed sanitation report.
 */
async function processZipBuffer(
  buffer: ArrayBuffer
): Promise<{
  zipInstance: JSZip;
  fileIndex: Map<string, FileEntry>;
  sanitationReport: SanitationReport;
}> {
  const zip = await JSZip.loadAsync(buffer);
  const fileIndex = new Map<string, FileEntry>();
  const skippedFiles: SkippedFile[] = [];

  const ig = ignore().add(EXPLICIT_DENY_PATTERNS);
  const acceptedExts = new Set(ACCEPTED_FILE_EXTENSIONS);

  // --- Smarter Path Normalization ---
  let commonBasePath = '';
  const filePaths = Object.values(zip.files).filter(f => !f.dir).map(f => f.name);

  if (filePaths.length > 0) {
    const firstPathParts = filePaths[0].split('/');
    if (firstPathParts.length > 1) {
      const potentialBase = `${firstPathParts[0]}/`;
      if (filePaths.every(p => p.startsWith(potentialBase))) {
        commonBasePath = potentialBase;
        console.log(`[ZipLoader] Detected and will strip common base path: ${commonBasePath}`);
      }
    }
  }


  for (const key in zip.files) {
    const file = zip.files[key];
    const path = file.name;

    if (file.dir) continue;

    // Use the new, smarter normalization logic
    const relativePath = commonBasePath ? path.substring(commonBasePath.length) : path;
    if (!relativePath) continue;

    // --- Sanitation Pipeline ---
    if (ig.ignores(relativePath)) {
      skippedFiles.push({ path, reason: 'IGNORED_PATH' });
      continue;
    }

    const lastDot = path.lastIndexOf('.');
    const ext = lastDot > 0 ? path.substring(lastDot + 1).toLowerCase() : '';
    if (ext && !acceptedExts.has(ext)) {
       const filename = path.includes('/') ? path.substring(path.lastIndexOf('/') + 1) : path;
       if (!acceptedExts.has(filename.toLowerCase())) {
            skippedFiles.push({ path, reason: 'INVALID_EXTENSION' });
            continue;
       }
    }

    const entry: FileEntry = {
      path: relativePath,
      size: (file as { _data?: { uncompressedSize: number } })._data?.uncompressedSize ?? 0,
      getText: () => file.async('text'),
      getUint8: () => file.async('uint8array'),
    };
    fileIndex.set(relativePath, entry);
  }

  const sanitationReport: SanitationReport = {
    processedCount: fileIndex.size,
    skippedCount: skippedFiles.length,
    skippedFiles,
  };

  return { zipInstance: zip, fileIndex, sanitationReport };
}

// --- Slice Definition ---
export interface LoaderSlice {
  loadFromDevServer: (retryCount?: number) => Promise<void>;
  loadZipFile: (file: File) => Promise<void>;
  reset: () => void;
}

export const createLoaderSlice: StateCreator<ZipState, [], [], LoaderSlice> = (set, get) => ({
  reset: () => get().loadFromDevServer(0),

  loadZipFile: async (file: File) => {
    // Stage 1: Pre-flight check
    const MAX_ZIP_SIZE_MB = 50;
    if (file.size > MAX_ZIP_SIZE_MB * 1024 * 1024) {
      set({
        status: 'error',
        source: 'none',
        error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max size is ${MAX_ZIP_SIZE_MB}MB.`,
        sanitationReport: null,
      });
      return;
    }

    set({ status: 'loading', error: null, graphStatus: 'idle', symbolGraph: null, sanitationReport: null });
    try {
      const buffer = await file.arrayBuffer();
      const { fileIndex, zipInstance, sanitationReport } = await processZipBuffer(buffer);

      if (fileIndex.size === 0) {
        throw new Error('After sanitation, no valid source files were found in this zip.');
      }

      const { createSyntheticManifest } = await import('./zip-state.js');
      const manifest = createSyntheticManifest(fileIndex);

      set({ manifest, fileIndex, zipInstance, status: 'ready', source: 'zip', error: null, sanitationReport });
      get().ensureSymbolGraph();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to parse ZIP.';
      set({ status: 'error', source: 'none', error: message, sanitationReport: null });
    }
  },

  loadFromDevServer: async (retryCount = 0) => {
    // On the very first attempt of a new load cycle, clean up any old errors.
    if (retryCount === 0) {
      // If this is the initial load of the app, set status to 'loading'.
      // Otherwise, keep the status as 'ready' so the UI can show "Stale".
      set({ 
        status: get().source === 'none' ? 'loading' : 'ready', 
        error: null 
      });
    }

    try {
      const manifestUrl = `/source-dump/_full-dump/dumpPaths.json?_=${Date.now()}`;
      const manifestRes = await fetch(manifestUrl);
      if (!manifestRes.ok) throw new Error('Manifest not found'); // Generic error for retry

      const manifest = (await manifestRes.json()) as DumpManifest;

      const zipUrl = `${manifest.dumpBase}/${manifest.concatZip}`;
      const zipRes = await fetch(zipUrl);
      if (!zipRes.ok) throw new Error('Zip file not found'); // Generic error for retry
      
      const buffer = await zipRes.arrayBuffer();
      const { fileIndex, zipInstance, sanitationReport } = await processZipBuffer(buffer);

      // On success, clear everything and set the new state.
      set({ manifest, fileIndex, zipInstance, status: 'ready', source: 'dev', error: null, sanitationReport });
      get().ensureSymbolGraph();
    } catch (_e: unknown) {
      // This is the resilient retry logic. It will try up to 30 times (60 seconds).
      if (retryCount < 30) {
        setTimeout(() => get().loadFromDevServer(retryCount + 1), 2000); // Wait 2s
      } else {
        // Only after all retries fail do we show the final error message.
        const message = 'Data not found. The source generation script is likely not running or has failed. Please check the terminal running `pnpm dev:slicer` and then click "Refresh Dev".';
        set({ status: 'error', source: 'none', error: message, sanitationReport: null });
      }
    }
  },
});