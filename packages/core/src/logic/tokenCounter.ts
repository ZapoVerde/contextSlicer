/**
 * @file packages/core/src/logic/tokenCounter.ts
 * @stamp {"ts":"2026-02-16T13:30:00Z"}
 * @architectural-role Utility
 * @description
 * Provides professional-grade token estimation for source code using the Tiktoken
 * algorithm. Replaces character-based heuristics with actual Byte Pair Encoding (BPE)
 * to ensure context packs stay within LLM limits (specifically calibrated for
 * high-density code environments).
 *
 * @core-principles
 * 1. IS a stateless logic utility for string metrics.
 * 2. MUST utilize the cl100k_base encoding to accurately count code symbols and indentation.
 * 3. ENFORCES architectural efficiency by memoizing the encoding instance.
 *
 * @api-declaration
 *   export function countTokens(text: string): number;
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

import { getEncoding, type Tiktoken } from 'js-tiktoken';

/**
 * Singleton instance of the tokenizer to prevent redundant initialization overhead.
 * cl100k_base is the industry standard for modern coding models (GPT-4, Claude 3, etc.).
 */
let tokenizerInstance: Tiktoken | null = null;

/**
 * Retrieves or initializes the Tiktoken encoding instance.
 */
function getTokenizer(): Tiktoken {
  if (!tokenizerInstance) {
    tokenizerInstance = getEncoding('cl100k_base');
  }
  return tokenizerInstance;
}

/**
 * @id packages/core/src/logic/tokenCounter.ts#countTokens
 * @description
 * Transforms a string into its BPE representation and returns the token count.
 * This handles multi-space indentation and complex CamelCase identifiers
 * significantly more accurately than character-length division.
 *
 * @param text - The raw source code or context pack text.
 * @returns The total number of tokens.
 */
export function countTokens(text: string): number {
  if (!text) {
    return 0;
  }

  const tokenizer = getTokenizer();
  const tokens = tokenizer.encode(text);
  return tokens.length;
}