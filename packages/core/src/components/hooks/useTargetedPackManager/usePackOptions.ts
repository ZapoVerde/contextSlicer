/**
 * @file packages/core/src/components/hooks/useTargetedPackManager/usePackOptions.ts
 * @stamp {"ts":"2026-02-15T11:20:00Z"}
 * @architectural-role Custom Hook / State Management
 * @description
 * Manages the UI configuration state for the Targeted Pack Manager. This hook 
 * encapsulates the toggle states that determine how much detail is extracted 
 * during the pack generation process.
 * 
 * @core-principles
 * 1. OWNS the UI configuration state for pack generation details.
 * 2. IS NOT responsible for the execution of the extraction logic.
 * 3. PROVIDES stable setters for UI components to modify generation behavior.
 * 
 * @contract
 *   assertions:
 *     purity: mutates # Standard React state management.
 *     state_ownership: [preambleOnly, docblocksOnly]
 *     external_io: none
 */

import { useState } from 'react';

/**
 * @id packages/core/src/components/hooks/useTargetedPackManager/usePackOptions.ts#usePackOptions
 * @description
 * Manages selection flags that control the level of detail in the generated pack.
 */
export function usePackOptions() {
  const [preambleOnly, setPreambleOnly] = useState<boolean>(false);
  const [docblocksOnly, setDocblocksOnly] = useState<boolean>(false);

  return {
    preambleOnly,
    docblocksOnly,
    setPreambleOnly,
    setDocblocksOnly,
  };
}