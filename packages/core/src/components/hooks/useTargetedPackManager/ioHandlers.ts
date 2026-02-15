/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/ioHandlers.ts
 * @stamp {"ts":"2026-02-15T11:30:00Z"}
 * @architectural-role Service / I/O Logic
 * @description
 * Provides logic handlers for browser-based I/O operations including file 
 * downloads (TXT/ZIP) and clipboard interactions. It abstracts the JSZip 
 * orchestration and Blob URL management.
 * 
 * @core-principles
 * 1. OWNS browser-specific I/O side effects (Downloads, Clipboard).
 * 2. MUST ensure proper cleanup of Blob URLs to prevent memory leaks.
 * 3. IS responsible for orchestrating multi-file binary gathering for ZIP exports.
 * 
 * @contract
 *   assertions:
 *     purity: side-effects
 *     external_io: [clipboard, browser_download]
 */

import JSZip from 'jszip';
import { generateFileTree } from '../../../logic/fileTreeUtils';
import type { FileEntry } from '../../../state/slicer-state';
import type { TargetedPath } from './types';

interface IoDependencies {
  fileIndex: Map<string, FileEntry> | null;
  parsedTargets: TargetedPath[];
  getContent: () => Promise<string>;
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/ioHandlers.ts#handleDownloadTxt
 * @description Generates a text blob from the context pack and triggers a browser download.
 */
export async function handleDownloadTxt(getContent: () => Promise<string>) {
  const content = await getContent();
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `targeted_pack_${Date.now()}.txt`;
  a.click();
  
  URL.revokeObjectURL(url);
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/ioHandlers.ts#handleCopyToClipboard
 * @description Copies the generated context pack text to the system clipboard.
 */
export async function handleCopyToClipboard(getContent: () => Promise<string>) {
  try {
    const content = await getContent();
    await navigator.clipboard.writeText(content);
  } catch (e) {
    console.error('[IO] Clipboard copy failed', e);
  }
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/ioHandlers.ts#handleDownloadZip
 * @description 
 * Gathers the binary content of all selected files and compiles them into 
 * a compressed ZIP archive for download.
 */
export async function handleDownloadZip(
  fileIndex: Map<string, FileEntry> | null,
  parsedTargets: TargetedPath[]
) {
  if (!fileIndex || parsedTargets.length === 0) return;

  const zip = new JSZip();
  const uniquePaths = new Set(parsedTargets.map(t => t.path));
  
  const tasks = Array.from(uniquePaths).map(async (path) => {
    const entry = fileIndex.get(path);
    if (entry) {
      const data = await entry.getUint8();
      return { path, data };
    }
    return null;
  });

  const files = await Promise.all(tasks);
  files.forEach(f => {
    if (f) zip.file(f.path, f.data);
  });
  
  if (Object.keys(zip.files).length === 0) return;

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `targeted_pack_${Date.now()}.zip`;
  a.click();
  
  URL.revokeObjectURL(url);
}

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/ioHandlers.ts#handleCopyTreeOnly
 * @description Generates only the spatial file tree and copies it to the clipboard.
 */
export async function handleCopyTreeOnly(parsedTargets: TargetedPath[]) {
  const tree = generateFileTree(parsedTargets.map(t => t.path));
  await navigator.clipboard.writeText(tree);
}