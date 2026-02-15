/**
 * @file packages/core/src/components/hooks/useTargetedPackManager.ts
 * @stamp {"ts":"2026-02-14T17:20:00Z"}
 * @architectural-role Custom Hook / State & Logic Controller
 *
 * @description
 * Manages state and logic for the Targeted Pack Generator. This version implements
 * the "Multi-Resolution" rendering logic. It parses the targeted file list for 
 * resolution suffixes (e.g., `path/to/file.ts:summary`) and conditionally 
 * applies the `generateSummary` engine or returns full text.
 * 
 * @core-principles
 * 1. ORCHESTRATES the assembly of the final context pack.
 * 2. ENFORCES resolution directives (Full vs Summary) defined in the path string.
 * 3. OPTIMIZES performance by parallelizing file reads and AST parsing.
 *
 * @contract
 *   assertions:
 *     purity: mutates # Updates local state and handles I/O (clipboard/download).
 *     state_ownership: [preambleOnly, docblocksOnly, selectedCount, ...]
 *     external_io: clipboard, browser_download
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import JSZip from 'jszip';
import * as parser from '@babel/parser';
import { useSlicerStore } from '../../state/useSlicerStore';
import { useFreshnessStatus } from '../../hooks/useFreshnessStatus';
import { generateFileTree } from '../../logic/fileTreeUtils';
import { extractFilePreamble } from '../../logic/preambleUtils';
import { generateSummary } from '../../logic/symbolGraph/summaryGenerator';

export function useTargetedPackManager() {
  const { fileIndex, targetedPathsInput, setTargetedPathsInput } = useSlicerStore();
  const { isStale } = useFreshnessStatus();

  const [preambleOnly, setPreambleOnly] = useState<boolean>(false);
  const [docblocksOnly, setDocblocksOnly] = useState<boolean>(false);
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const [selectedBytes, setSelectedBytes] = useState<number>(0);

  // Parse inputs into structured objects { path, mode }
  const parsedTargets = useMemo(() => {
    return targetedPathsInput.split(',').map(s => {
      const trimmed = s.trim();
      if (!trimmed) return null;
      
      const parts = trimmed.split(':');
      // If the last part is 'summary', treat it as a directive
      if (parts.length > 1 && parts[parts.length - 1] === 'summary') {
        const path = parts.slice(0, -1).join(':'); // Rejoin in case path had colons
        return { path, resolution: 'summary' as const };
      }
      return { path: trimmed, resolution: 'full' as const };
    }).filter((t): t is { path: string; resolution: 'full' | 'summary' } => t !== null);
  }, [targetedPathsInput]);

  // Update statistics
  useEffect(() => {
    if (!fileIndex || parsedTargets.length === 0) {
      setSelectedCount(0);
      setSelectedBytes(0);
      return;
    }
    let count = 0;
    let bytes = 0;
    for (const target of parsedTargets) {
      const ent = fileIndex.get(target.path);
      if (ent) {
        count++;
        // If summary, we estimate size is much smaller (e.g., 10% or fixed overhead)
        // For now, we count full size to be conservative on token estimation
        bytes += target.resolution === 'summary' ? Math.min(ent.size, 500) : ent.size;
      }
    }
    setSelectedCount(count);
    setSelectedBytes(bytes);
  }, [fileIndex, parsedTargets]);

  /**
   * Generates the final text content, respecting resolution flags.
   */
  const getFormattedTextContent = useCallback(async (): Promise<string> => {
    if (!fileIndex) return '';

    const tasks = parsedTargets.map(async (target) => {
      const ent = fileIndex.get(target.path);
      if (!ent) return null;

      try {
        const content = await ent.getText();

        // CASE A: Summary Mode
        if (target.resolution === 'summary') {
          // We need to parse AST on the fly for summary generation
          const ast = parser.parse(content, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
            errorRecovery: true,
          });
          const summary = generateSummary(target.path, ast, content);
          return `// ----- ${target.path} (SUMMARY) -----\n${summary}`;
        }

        // CASE B: Full Text Mode
        let processedContent = content;
        if (docblocksOnly) {
          const preamble = extractFilePreamble(content);
          processedContent = preamble || '// (No docblock found)';
        }
        
        // PreambleOnly is deprecated in UI but kept in logic just in case
        if (preambleOnly) {
           const preamble = extractFilePreamble(content);
           processedContent = preamble || '// (No preamble found)';
        }

        return `// ----- ${target.path} -----\n${processedContent}`;
      } catch (e) {
        console.warn(`Failed to process ${target.path}`, e);
        return `// ----- ${target.path} (ERROR) -----\n// Failed to read or parse file.`;
      }
    });

    const results = await Promise.all(tasks);
    const validParts = results.filter((r): r is string => r !== null);
    const tree = generateFileTree(parsedTargets.map(t => t.path));

    return [
      `--- START OF FILE targeted_source_pack - ${new Date().toISOString()} ---`,
      tree,
      ...validParts,
      '--- END OF PACK ---'
    ].join('\n\n');
  }, [fileIndex, parsedTargets, docblocksOnly, preambleOnly]);

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
      // In a real app, we'd use a toast here. For now, we rely on the caller to show feedback 
      // or we could return a promise that resolves.
    } catch (e) {
      console.error('Clipboard failed', e);
    }
  }, [getFormattedTextContent]);

  // Binary download only supports full files (zips don't usually contain summaries)
  const handleDownloadZip = useCallback(async () => {
    if (!fileIndex) return;
    const out = new JSZip();
    
    // We filter for distinct paths to avoid duplicates if user messed up string
    const uniquePaths = new Set(parsedTargets.map(t => t.path));
    
    const tasks = Array.from(uniquePaths).map(async (path) => {
      const ent = fileIndex.get(path);
      if (ent) {
        return { path, data: await ent.getUint8() };
      }
      return null;
    });

    const files = await Promise.all(tasks);
    files.forEach(f => {
      if (f) out.file(f.path, f.data);
    });
    
    if (Object.keys(out.files).length === 0) return;
    const blob = await out.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'targeted_source_pack.zip';
    a.click();
    URL.revokeObjectURL(a.href);
  }, [fileIndex, parsedTargets]);
  
  const handleCopyTreeOnly = useCallback(async () => {
    const tree = generateFileTree(parsedTargets.map(t => t.path));
    await navigator.clipboard.writeText(tree);
  }, [parsedTargets]);

  return {
    isReady: !!fileIndex,
    isStale,
    canExport: !!fileIndex && !isStale && parsedTargets.length > 0,
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