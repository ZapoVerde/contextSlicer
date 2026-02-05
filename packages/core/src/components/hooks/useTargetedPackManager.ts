// ----- packages/core/src/components/hooks/useTargetedPackManager.ts -----
/**
 * @file packages/core/src/components/hooks/useTargetedPackManager.ts
 * @stamp {"ts":"2025-12-05T15:30:00Z"}
 * @architectural-role Custom Hook / State & Logic Controller
 *
 * @description
 * Manages state and logic for the Targeted Pack Generator. This version has
 * been optimized with parallel I/O fetching to eliminate the "Network Waterfall"
 * bottleneck in Desktop mode.
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import JSZip from 'jszip';
import { useSlicerStore } from '../../state/useSlicerStore';
import { useFreshnessStatus } from '../../hooks/useFreshnessStatus';
import { generateFileTree } from '../../logic/fileTreeUtils';
import { extractFilePreamble } from '../../logic/preambleUtils';

export function useTargetedPackManager() {
  const { fileIndex, targetedPathsInput, setTargetedPathsInput } = useSlicerStore();
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

  /**
   * Optimally fetches all required file contents in parallel.
   */
  const fetchAllContent = useCallback(async (mode: 'text' | 'binary') => {
    if (!fileIndex) return [];
    
    const tasks = normalizedPaths.map(async (path) => {
      const ent = fileIndex.get(path);
      if (!ent) return null;
      
      const content = mode === 'text' ? await ent.getText() : await ent.getUint8();
      return { path, content };
    });

    // Execute all fetches concurrently
    const results = await Promise.all(tasks);
    return results.filter((r): r is { path: string; content: string | Uint8Array } => r !== null);
  }, [fileIndex, normalizedPaths]);

  const getFormattedTextContent = useCallback(async (): Promise<string> => {
    const files = await fetchAllContent('text');
    const fileParts: string[] = [];
    
    const preamble = `${generateFileTree(normalizedPaths)}\n\n`;

    for (const file of files) {
      const text = file.content as string;
      const contentToAdd = docblocksOnly ? extractFilePreamble(text) : text;
      if (contentToAdd) {
        fileParts.push(`// ----- ${file.path} -----\n${contentToAdd}`);
      }
    }
    
    return `--- START OF FILE targeted_source_pack.txt ---\n\n${preamble}${fileParts.join('\n\n')}\n\n--- END OF FILE targeted_source_pack.txt ---`;
  }, [fetchAllContent, normalizedPaths, docblocksOnly]);

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
    const files = await fetchAllContent('binary');
    const out = new JSZip();
    
    for (const file of files) {
      out.file(file.path, file.content as Uint8Array);
    }
    
    if (Object.keys(out.files).length === 0) return;
    const blob = await out.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'targeted_source_pack.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [fetchAllContent]);
  
  const handleCopyTreeOnly = useCallback(async () => {
    const tree = generateFileTree(normalizedPaths);
    await navigator.clipboard.writeText(tree);
    alert('File tree copied to clipboard.');
  }, [normalizedPaths]);

  return {
    isReady: !!fileIndex,
    isStale,
    canExport: !!fileIndex && !isStale && normalizedPaths.length > 0,
    targetedPathsInput,
    selectedCount,
    approxTokens: Math.round(selectedBytes / 4).toLocaleString(),
    preambleOnly,
    docblocksOnly,
    setTargetedPathsInput,
    setPreambleOnly,
    setDocblocksOnly,
    handleCopyToClipboard,
    handleDownloadTxt,
    handleDownloadZip,
    handleCopyTreeOnly,
  };
}