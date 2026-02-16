/**
 * @file packages/core/src/logic/wildcardUtils.ts
 * @stamp {"ts":"2026-02-16T07:20:00Z"}
 * @architectural-role Logic Utility / String Parser
 * @description
 * This module provides a standalone utility function for converting a
 * user-friendly wildcard pattern (glob-like) into a formal regular expression.
 *
 * @core-principles
 * 1. IS a pure, stateless string transformation utility.
 * 2. MUST accurately map glob patterns to regular expressions.
 * 3. ENFORCES directory-aware matching (distinguishing between * and **).
 *
 * @api-declaration
 *   export function wildcardToRegExp(pattern: string): RegExp;
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

/**
 * @id packages/core/src/logic/wildcardUtils.ts#wildcardToRegExp
 * @description
 * Converts a wildcard pattern string into a regular expression.
 * Supports:
 *   - Asterisk: matches any character except a slash (single directory segment)
 *   - Double Asterisk: matches any character including slashes (recursive)
 *   - Recursive Directory: matches zero or more directory segments
 * 
 * @param pattern - The wildcard pattern (e.g., "src/** / *.ts").
 * @returns A compiled RegExp anchored to the start and end of the string.
 */
export function wildcardToRegExp(pattern: string): RegExp {
  // 1. Placeholder strategy to protect wildcards during escaping
  const DOUBLE_STAR_DIR = '%%DOUBLE_STAR_DIR%%';
  const DOUBLE_STAR = '%%DOUBLE_STAR%%';
  const SINGLE_STAR = '%%SINGLE_STAR%%';

  // 2. Swap wildcards for safe placeholders.
  // We prioritize the directory-recursive pattern "**/" to allow zero-length matches.
  let temp = pattern
    .replace(/\*\*\//g, DOUBLE_STAR_DIR)
    .replace(/\*\*/g, DOUBLE_STAR)
    .replace(/\*/g, SINGLE_STAR);

  // 3. Escape all special regex characters to treat them as literals.
  temp = temp.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

  // 4. Swap placeholders back to Regex equivalents
  // DOUBLE_STAR_DIR: matches zero segments (empty) or multiple segments ending in /
  // DOUBLE_STAR: matches any sequence including slashes
  // SINGLE_STAR: matches any sequence excluding slashes
  temp = temp
    .replace(new RegExp(DOUBLE_STAR_DIR, 'g'), '(?:.*/)?')
    .replace(new RegExp(DOUBLE_STAR, 'g'), '.*')
    .replace(new RegExp(SINGLE_STAR, 'g'), '[^/]*');

  // 5. Anchor the regex to match the full path string.
  // Prepended (?:.*/)? ensures "web/App.tsx" matches "packages/web/App.tsx"
  // which is common in monorepo environments where users might omit the root.
  return new RegExp(`^(?:.*/)?${temp}$`, 'i');
}