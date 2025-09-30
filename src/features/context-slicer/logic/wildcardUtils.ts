/**
 * @file src/features/sourceDump/logic/wildcardUtils.ts
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
 *
 * @purpose This utility is the engine behind the "Wildcard Search" in the
 * `ContextQueryPanel`, allowing users to make powerful, broad selections of files
 * without needing to write complex regular expressions themselves.
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
  // Use unique placeholders to avoid conflicts with file names.
  const placeholderDoubleStar = `__DOUBLE_STAR_PLACEHOLDER_${Date.now()}__`;
  const placeholderSingleStar = `__SINGLE_STAR_PLACEHOLDER_${Date.now()}__`;

  // 1. Replace our special wildcards with safe placeholders first.
  const tempPattern = pattern
    .replace(/\*\*/g, placeholderDoubleStar)
    .replace(/\*/g, placeholderSingleStar);

  // 2. Now, escape all special RegExp characters in the rest of the string.
  const escapedPattern = tempPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

  // 3. Finally, replace the placeholders with their actual RegExp equivalents.
  const finalPattern = escapedPattern
    .replace(new RegExp(placeholderDoubleStar, 'g'), '.*')
    .replace(new RegExp(placeholderSingleStar, 'g'), '[^/]*');

  // 4. Create the final RegExp, anchored to the start and end of the string.
  return new RegExp(`^${finalPattern}$`,'i');
}