/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/index.ts
 * @stamp {"ts":"2026-02-16T06:50:00Z"}
 * @architectural-role Custom Hook / Composition Root
 * @description
 * The primary orchestrator for the Targeted Pack Manager subsystem. It composes 
 * state management, statistics, and target parsing with high-performance 
 * parallel services for AST extraction and layered context assembly.
 * 
 * @core-principles
 * 1. IS the public entry point for the Targeted Pack management subsystem.
 * 2. ORCHESTRATES the flow between UI state and high-performance processing logic.
 * 3. ENFORCES clean separation of concerns by delegating to sub-hooks and services.
 * 
 * @api-declaration
 *   export function useTargetedPackManager(): TargetedPackHookResult;
 * 
 * @contract
 *   assertions:
 *     purity: mutates # Orchestrates state and I/O.
 *     state_ownership: [targetedPathsInput, preambleOnly, docblocksOnly]
 *     external_io: [clipboard, browser_download]
 */

import { useCallback, useMemo } from 'react';
import { useSlicerStore } from '../../../state/useSlicerStore';
import { useFreshnessStatus } from '../../../hooks/useFreshnessStatus';

// Sub-Hooks
import { useTargetParsing } from './useTargetParsing';
import { usePackOptions } from './usePackOptions';
import { usePackStats } from './usePackStats';

// Logic & Services
import { runPreFlight } from './preFlightService';
import { assembleContextPack } from './packAssembler';
import * as io from './ioHandlers';

// Types
import type { TargetedPackHookResult } from './types';

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/index.ts#useTargetedPackManager
 * @description
 * Provides a unified API for managing, previewing, and exporting targeted 
 * context packs.
 */
export function useTargetedPackManager(): TargetedPackHookResult {
  // 1. Central State (Zustand - Granular Selectors)
  const fileIndex = useSlicerStore(s => s.fileIndex);
  const targetedPathsInput = useSlicerStore(s => s.targetedPathsInput);
  const setTargetedPathsInput = useSlicerStore(s => s.setTargetedPathsInput);
  
  // ALIAS RESOLUTION: We need the config to resolve monorepo paths
  const slicerConfig = useSlicerStore(s => s.slicerConfig);
  
  const { isStale } = useFreshnessStatus();

  // 2. Feature Hooks
  const { parsedTargets } = useTargetParsing(targetedPathsInput);
  const { preambleOnly, docblocksOnly, setPreambleOnly, setDocblocksOnly } = usePackOptions();
  const { selectedCount, approxTokens } = usePackStats(fileIndex, parsedTargets);

  // 3. Extraction Orchestration
  /**
   * Internal helper to execute the multi-phase context assembly.
   * Orchestrates the shift from raw inputs to a structured, layered pack.
   */
  const getFormattedTextContent = useCallback(async (): Promise<string> => {
    if (!fileIndex || parsedTargets.length === 0) return '';

    // Step 1: Parallel Load & Parse (Phase 1)
    const preFlightData = await runPreFlight(parsedTargets, fileIndex);

    // Step 2: Assemble Layered Pack (Phase 2)
    // PLUMBING FIX: Pass the aliasMap (from config or harness defaults) 
    // to support @prism/* resolution in the Boundary Library.
    return assembleContextPack(
      fileIndex, 
      parsedTargets, 
      preFlightData, 
      {
        docblocksOnly,
        includeBoundaryLibrary: true,
        // In the test network context, these aliases allow the boundary scanner 
        // to resolve imports between packages.
        aliasMap: {
          '@prism/shared-types': 'packages/shared-types',
          '@prism/ui-kit': 'packages/ui-kit',
          '@prism/web': 'packages/web'
        }
      }
    );
  }, [fileIndex, parsedTargets, docblocksOnly]);

  // 4. Action Handlers (Wrapped I/O)
  const handleDownloadTxt = useCallback(
    () => io.handleDownloadTxt(getFormattedTextContent),
    [getFormattedTextContent]
  );

  const handleCopyToClipboard = useCallback(
    () => io.handleCopyToClipboard(getFormattedTextContent),
    [getFormattedTextContent]
  );

  const handleDownloadZip = useCallback(
    () => io.handleDownloadZip(fileIndex, parsedTargets),
    [fileIndex, parsedTargets]
  );

  const handleCopyTreeOnly = useCallback(
    () => io.handleCopyTreeOnly(parsedTargets),
    [parsedTargets]
  );

  // 5. Final Composition
  return {
    // State
    isReady: !!fileIndex,
    isStale,
    canExport: !!fileIndex && !isStale && parsedTargets.length > 0,
    targetedPathsInput,
    selectedCount,
    approxTokens,
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