/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/index.ts
 * @stamp {"ts":"2026-02-16T17:15:00Z"}
 * @architectural-role Feature Entry Point
 * @description
 * The primary orchestrator for the Targeted Pack Manager subsystem. Implements 
 * the Optimistic Assembly pattern:
 * 1. Monitors the path list (Trigger 1) to auto-trigger background assembly (Trigger 2).
 * 2. Provides instantaneous handlers for final export by consuming pre-built state.
 * 3. EXPOSES the isAssembling flag to drive visual lockout of DL/Copy buttons.
 * 
 * @core-principles
 * 1. IS the composition root for the Targeted Pack management subsystem.
 * 2. ORCHESTRATES the automated transition from list population to background assembly.
 * 3. ENFORCES the "Instant Action" rule for final exports.
 * 
 * @contract
 *   assertions:
 *     purity: mutates # Orchestrates background state transitions.
 *     state_ownership: none # Delegates to sub-hooks and global store.
 */

import { useCallback, useEffect } from 'react';
import { useSlicerStore } from '../../../state/useSlicerStore.js';
import { useFreshnessStatus } from '../../../hooks/useFreshnessStatus.js';

// Sub-Hooks
import { useTargetParsing } from './useTargetParsing.js';
import { usePackOptions } from './usePackOptions.js';
import { usePackStats } from './usePackStats.js';

// Logic & I/O
import * as io from './ioHandlers.js';

// Types
import type { TargetedPackHookResult } from './types.js';

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/index.ts#useTargetedPackManager
 * @description
 * Provides a unified API for context pack lifecycle management.
 */
export function useTargetedPackManager(): TargetedPackHookResult {
  // 1. Central State Selectors (Granular)
  const fileIndex = useSlicerStore(s => s.fileIndex);
  const targetedPathsInput = useSlicerStore(s => s.targetedPathsInput);
  const setTargetedPathsInput = useSlicerStore(s => s.setTargetedPathsInput);
  
  // Optimistic Background State
  const isAssembling = useSlicerStore(s => s.isAssembling);
  const assembledPackText = useSlicerStore(s => s.assembledPackText);
  const orchestrateAssembly = useSlicerStore(s => s.orchestrateAssembly);
  
  const { isStale } = useFreshnessStatus();

  // 2. Feature Hooks
  const { parsedTargets } = useTargetParsing(targetedPathsInput);
  const { preambleOnly, docblocksOnly, setPreambleOnly, setDocblocksOnly } = usePackOptions();
  
  // Stats consumes the accurateTokenCount from state internally
  const { selectedCount, approxTokens, isAccurate } = usePackStats(fileIndex, parsedTargets);

  // 3. Trigger 2: Optimistic Background Assembly
  /**
   * Effect: Monitors Trigger 1 (path list) and extraction options.
   * Dispatches the ASSEMBLE_PACK task to the Worker Pool immediately.
   */
  useEffect(() => {
    // If list is empty or source removed, reset is handled by the store
    if (!fileIndex || parsedTargets.length === 0) return;

    orchestrateAssembly(parsedTargets, {
      docblocksOnly,
      // We always enable the boundary library for professional packs
      includeBoundaryLibrary: true,
    });
  }, [fileIndex, parsedTargets, docblocksOnly, orchestrateAssembly]);

  // 4. Instantaneous Content Handlers
  /**
   * Helper that resolves the pre-assembled text from state.
   * This is passed to I/O handlers to ensure they remain functional 
   * without triggering new Babel parses on the main thread.
   */
  const getAssembledContent = useCallback(async (): Promise<string> => {
    return assembledPackText || '';
  }, [assembledPackText]);

  // 5. Action Handlers (Wrapped I/O)
  const handleDownloadTxt = useCallback(
    () => io.handleDownloadTxt(getAssembledContent),
    [getAssembledContent]
  );

  const handleCopyToClipboard = useCallback(
    () => io.handleCopyToClipboard(getAssembledContent),
    [getAssembledContent]
  );

  // Note: Zip download remains physical (gathering files), not text-based
  const handleDownloadZip = useCallback(
    () => io.handleDownloadZip(fileIndex, parsedTargets),
    [fileIndex, parsedTargets]
  );

  const handleCopyTreeOnly = useCallback(
    () => io.handleCopyTreeOnly(parsedTargets),
    [parsedTargets]
  );

  // 6. Logic: Export Readiness (The Lockout Flag)
  // We can export if we have data AND the worker has finished (isAssembling is false).
  const canExport = !!fileIndex && !isStale && parsedTargets.length > 0 && !isAssembling;

  // 7. Final Composition
  return {
    // State
    isReady: !!fileIndex,
    isStale,
    canExport,
    targetedPathsInput,
    selectedCount,
    approxTokens,
    isAccurate,
    isAssembling,
    preambleOnly,
    docblocksOnly,

    // Actions
    setTargetedPathsInput,
    setPreambleOnly,
    setDocblocksOnly,
    handleCopyToClipboard,
    handleDownloadTxt,
    handleDownloadZip,
    handleCopyTreeOnly,
  };
}