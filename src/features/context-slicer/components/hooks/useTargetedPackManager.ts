/**
 * @file src/features/context-slicer/components/hooks/useTargetedPackManager.ts
 * @stamp {"ts":"2025-09-28T18:24:00Z"}
 * @architectural-role Custom Hook / State & Logic Controller
 *
 * @description
 * This hook encapsulates all state management and business logic for the "Targeted
 * Pack Generator" feature. It acts as the "brain" for the `TargetedPackPanel`,
 * providing a clean, declarative interface of state and actions to its consuming
 * UI components. It was created by refactoring the original `TargetedPackPanel`
 * to separate concerns, isolating complex logic from presentation.
 *
 * @contract
 * State Ownership:
 *   - Owns all local UI state for the feature, including checkbox states (`preambleOnly`,
 *     `docblocksOnly`) and derived stats (`selectedCount`, `selectedBytes`).
 *   - Consumes global state (`fileIndex`, `targetedPathsInput`) from `useZipStore`.
 * Public API: Returns an object containing state/derived values (`isReady`, `canExport`,
 *   `targetedPathsInput`, etc.) and action handlers (`handleCopyToClipboard`,
 *   `handleDownloadZip`, etc.).
 * Core Invariants:
 *   - The hook's primary responsibility is to derive UI state and generate exportable
 *     artifacts based on the `targetedPathsInput` from the global `useZipStore`.
 *   - The action handlers are designed to be used in conjunction with the `canExport`
 *     flag to prevent actions on invalid state.
 *
 * @core-principles
 * 1. **Single Responsibility Principle:** This hook has the single responsibility of
 *    managing the state and logic for its feature, leaving rendering to dedicated
 *    presentational components.
 * 2. **State Encapsulation:** All local UI state for the pack generator is owned and
 *    managed exclusively by this hook.
 * 3. **Clear API:** It provides a stable and explicit API (the returned object) to its
 *    consumers, hiding the complexity of its internal implementation.
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import JSZip from 'jszip';
import { useZipStore } from '../../state/useZipStore';
import { useFreshnessStatus } from '../../hooks/useFreshnessStatus';
import { generateFileTree } from '../../logic/fileTreeUtils';
import { extractFilePreamble } from '../../logic/preambleUtils';

/**
 * Manages all state and logic for the Targeted Pack Generator.
 */
export function useTargetedPackManager() {
  const { fileIndex, targetedPathsInput, setTargetedPathsInput } = useZipStore();
  const { isStale } = useFreshnessStatus();

  const [preambleOnly, setPreambleOnly] = useState<boolean>(false);
  const [docblocksOnly, setDocblocksOnly] = useState<boolean>(false);
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const [selectedBytes, setSelectedBytes] = useState<number>(0);

  const normalizedPaths = useMemo(() => {
    return targetedPathsInput.split(',').map(s => s.trim()).filter(Boolean);
  }, [targetedPathsInput]);

  useEffect(() => {
    if (!fileIndex || normalizedPaths.length === 0) {
      setSelectedCount(0);
      setSelectedBytes(0);
      return;
    }
    let count = 0;
    let bytes = 0;
    for (const p of normalizedPaths) {
      const ent = fileIndex.get(p);
      if (ent) {
        count++;
        bytes += ent.size || 0;
      }
    }
    setSelectedCount(count);
    setSelectedBytes(bytes);
  }, [fileIndex, normalizedPaths]);

  // --- START OF CHANGE: The logic is now even simpler ---
  const getFormattedTextContent = useCallback(async (): Promise<string> => {
    if (!fileIndex) return '';
    const fileParts: string[] = [];
    
    // The file tree preamble is now always generated and included.
    const preamble = `${generateFileTree(normalizedPaths)}\n\n`;

    for (const p of normalizedPaths) {
      const ent = fileIndex.get(p);
      if (!ent) continue;
      const fullText = await ent.getText();
      const contentToAdd: string | null = docblocksOnly ? extractFilePreamble(fullText) : fullText;
      if (contentToAdd) {
        fileParts.push(`// ----- ${p} -----\n${contentToAdd}`);
      }
    }
    return `--- START OF FILE targeted_source_pack.txt ---\n\n${preamble}${fileParts.join('\n\n')}\n\n--- END OF FILE targeted_source_pack.txt ---`;
  }, [fileIndex, normalizedPaths, docblocksOnly]);
  // --- END OF CHANGE ---

  const handleDownloadTxt = useCallback(async () => {
    const content = await getFormattedTextContent();
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'targeted_source_pack.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [getFormattedTextContent]);
  
  const handleCopyToClipboard = useCallback(async () => {
    try {
      const content = await getFormattedTextContent();
      await navigator.clipboard.writeText(content);
      alert('Copied to clipboard');
    } catch {
      alert('Clipboard copy failed.');
    }
  }, [getFormattedTextContent]);

  const handleDownloadZip = useCallback(async () => {
    if (!fileIndex) return;
    const out = new JSZip();
    for (const p of normalizedPaths) {
      const ent = fileIndex.get(p);
      if (!ent) continue;
      out.file(p, await ent.getUint8());
    }
    if (Object.keys(out.files).length === 0) return;
    const blob = await out.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'targeted_source_pack.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [fileIndex, normalizedPaths]);
  
  const handleCopyTreeOnly = useCallback(async () => {
    const tree = generateFileTree(normalizedPaths);
    await navigator.clipboard.writeText(tree);
    alert('File tree copied to clipboard.');
  }, [normalizedPaths]);

  return {
    // State and Derived Values
    isReady: !!fileIndex,
    isStale,
    canExport: !!fileIndex && !isStale && normalizedPaths.length > 0,
    targetedPathsInput,
    selectedCount,
    approxTokens: Math.round(selectedBytes / 4).toLocaleString(),
    preambleOnly,
    docblocksOnly,

    // Actions and Setters
    setTargetedPathsInput,
    setPreambleOnly,
    setDocblocksOnly,
    handleCopyToClipboard,
    handleDownloadTxt,
    handleDownloadZip,
    handleCopyTreeOnly,
  };
}