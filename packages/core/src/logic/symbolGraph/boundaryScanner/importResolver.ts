/**
 * @file packages/core/src/logic/symbolGraph/boundaryScanner/importResolver.ts
 * @stamp {"ts":"2026-02-15T21:35:00Z"}
 * @architectural-role Business Logic / Utility
 * @description
 * Provides resolution logic for both relative and aliased import paths. It 
 * transforms a source string (e.g., '../../utils' or '@prism/shared') into 
 * an absolute project-root key by checking against an alias map and 
 * simulating directory traversal.
 * 
 * @core-principles
 * 1. IS a pure, stateless resolution engine.
 * 2. OWNS the heuristic for identifying script file candidates (extensions/index files).
 * 3. SUPPORTS monorepo aliases to enable cross-package boundary discovery.
 * 
 * @api-declaration
 *   export function resolveImportPath(
 *     currentFile: string,
 *     importSource: string,
 *     fileIndex: Map<string, unknown>,
 *     aliasMap?: Record<string, string>
 *   ): string | null;
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

/**
 * Ordered list of candidate extensions and index patterns.
 */
const RESOLUTION_CANDIDATES = [
  '.ts', 
  '.tsx', 
  '.js', 
  '.jsx', 
  '/index.ts', 
  '/index.tsx', 
  '/index.js', 
  '/index.jsx'
] as const;

/**
 * Internal browser-safe path utilities to maintain consistency with PathResolver.
 */
const pathUtils = {
  join: (...parts: string[]): string => {
    return parts.join('/').replace(/\/+/g, '/');
  },
  normalize: (p: string): string => {
    const parts = p.split('/');
    const stack: string[] = [];
    for (const part of parts) {
      if (part === '.' || part === '') continue;
      if (part === '..') {
        if (stack.length > 0) stack.pop();
      } else {
        stack.push(part);
      }
    }
    return stack.join('/');
  }
};

/**
 * @id packages/core/src/logic/symbolGraph/boundaryScanner/importResolver.ts#resolveImportPath
 * @description
 * Resolves an import path to a project-root key. 
 * Priority: 1. Alias Match -> 2. Relative Match.
 * 
 * @param currentFile - The absolute project path of the file containing the import.
 * @param importSource - The raw string value of the import source.
 * @param fileIndex - The registry of all existing files in the project.
 * @param aliasMap - Optional mapping of path aliases to physical directories.
 */
export function resolveImportPath(
  currentFile: string,
  importSource: string,
  fileIndex: Map<string, unknown>,
  aliasMap: Record<string, string> = {}
): string | null {
  let basePath: string | null = null;
  const importSourceWithoutExt = importSource.replace(/\.(ts|tsx|js|jsx)$/, '');

  // 1. Try Alias Resolution (e.g., @prism/shared -> packages/shared)
  for (const alias in aliasMap) {
    if (importSourceWithoutExt.startsWith(alias)) {
      const target = aliasMap[alias];
      const remaining = importSourceWithoutExt.substring(alias.length);
      basePath = pathUtils.normalize(pathUtils.join(target, remaining));
      break;
    }
  }

  // 2. Fallback to Relative Resolution (e.g., ./utils -> currentDir/utils)
  if (!basePath && importSourceWithoutExt.startsWith('.')) {
    const stack = currentFile.split('/');
    stack.pop(); // Remove filename
    
    const parts = importSourceWithoutExt.split('/');
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        if (stack.length > 0) stack.pop();
        continue;
      }
      stack.push(part);
    }
    basePath = stack.join('/');
  }

  if (!basePath) return null;

  // 3. Candidate Matching
  // Check direct match first
  if (fileIndex.has(basePath)) {
    return basePath;
  }

  // Check extensions and index patterns
  for (const ext of RESOLUTION_CANDIDATES) {
    const candidate = `${basePath}${ext}`;
    if (fileIndex.has(candidate)) {
      return candidate;
    }
  }

  return null;
}