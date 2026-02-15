/**
 * @file packages/core/src/logic/wildcardUtils.ts
 * @architectural-role Logic Utility / String Parser
 *
 * @description This module provides a standalone utility function for converting a
 * user-friendly wildcard pattern (glob-like) into a formal regular expression.
 *
 * @responsibilities
 * 1.  **Pattern Conversion:** It takes a string pattern as input.
 * 2.  **Wildcard Handling:** It specifically handles two common wildcards:
 *     - `**`: Converts to `.*` to match any sequence of characters, including slashes, 
 *       for recursive directory matching.
 *     - `*`: Converts to `[^/]*` to match any sequence of characters *except* a slash,
 *       for matching within a single directory.
 * 3.  **Regex Escaping:** It safely escapes all other special regular expression
 *     characters in the input string to ensure they are treated as literal characters.
 * 4.  **RegExp Object Creation:** It returns a final, compiled `RegExp` object, ready
 *     to be used for matching against file paths.
 */

/**
 * Converts a wildcard pattern string into a regular expression.
 * Supports:
 *   - `*`: matches any character except a slash
 *   - `**`: matches any character including slashes
 * @param pattern - The wildcard pattern.
 * @returns A RegExp object.
 */
export function wildcardToRegExp(pattern: string): RegExp {
  // 1. Placeholder strategy to protect wildcards during escaping
  const DOUBLE_STAR = '%%DOUBLE_STAR%%';
  const SINGLE_STAR = '%%SINGLE_STAR%%';

  // 2. Swap wildcards for safe placeholders
  let temp = pattern
    .replace(/\*\*/g, DOUBLE_STAR)
    .replace(/\*/g, SINGLE_STAR);

  // 3. Escape all special regex characters.
  // We use \\\\$& to ensure the final string passed to new RegExp has double backslashes.
  // e.g. '.' -> '\\.' -> new RegExp('\\.') -> matches literal dot.
  temp = temp.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

  // 4. Swap placeholders back to Regex equivalents
  temp = temp
    .replace(new RegExp(DOUBLE_STAR, 'g'), '.*')
    .replace(new RegExp(SINGLE_STAR, 'g'), '[^/]*');

  // 5. Anchor the regex to match the full path
  return new RegExp(`^${temp}$`, 'i');
}