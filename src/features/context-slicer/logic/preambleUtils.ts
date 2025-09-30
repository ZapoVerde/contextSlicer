/**
 * @file src/features/context-slicer/logic/preambleUtils.ts
 * @stamp {"ts":"2025-09-28T18:24:00Z"}
 * @architectural-role Logic Utility / Text Processor
 *
 * @description
 * This is a self-contained utility module that provides a pure function for
 * extracting the leading JSDoc-style block comment from a file's content.
 * It was created to support the "Docblocks Only" export feature.
 *
 * @contract
 * State Ownership: This module is stateless.
 * Public API: `extractFilePreamble(content: string): string | null`
 * Core Invariants: The function must correctly identify and return the first
 * block comment from the start of a string, or return null if
 * no such comment is present at the beginning of the content.
 *
 * @core-principles
 * 1. IS a pure, stateless function with no side effects.
 * 2. HAS a single, clear responsibility: extracting the preamble comment.
 * 3. IS completely decoupled from the application's state and UI.
 */
export function extractFilePreamble(content: string): string | null {
  // This regex looks for the first open block at the start of the file,
  // allowing for leading whitespace, and captures everything until the first `*/`.
  const match = content.match(/^\s*(\/\*\*[\s\S]*?\*\/)/);

  return match ? match[1] : null;
}