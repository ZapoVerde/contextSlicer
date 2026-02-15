/**
 * @file packages/core/src/logic/symbolGraph/pathResolver.ts
 * @stamp {"ts":"2026-02-15T23:05:00Z"}
 * @architectural-role Utility
 * @description
 * Resolves module import paths (relative and aliased) into absolute project-root keys.
 * Acts as the primary address resolution engine for the symbol graph builder.
 *
 * @core-principles
 * 1. IS responsible for mapping import strings to physical file paths.
 * 2. MUST remain pure and stateless.
 * 3. ENFORCES mapping based on the actual filesystem state provided via the file index.
 *
 * @api-declaration
 *   export class PathResolver {
 *     constructor(filePaths: string[], aliasMap?: Record<string, string>);
 *     public resolve(fromPath: string, importPath: string, errors: string[]): string | null;
 *   }
 *
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

export class PathResolver {
  private filePaths: Set<string>;
  private resolutionCache = new Map<string, string | null>();
  private aliasMap: Record<string, string>;
  private packageRoots: { root: string; name: string }[];

  constructor(filePaths: string[], aliasMap: Record<string, string> = {}) {
    this.filePaths = new Set(filePaths);
    this.aliasMap = aliasMap;
    this.packageRoots = Object.entries(aliasMap).map(([name, aliasPath]) => ({
      name,
      root: aliasPath.substring(0, aliasPath.lastIndexOf('/')),
    }));
  }

  /**
   * Identifies which monorepo package a specific file belongs to.
   */
  private getPackageRoot(filePath: string): string | null {
    const match = this.packageRoots
      .filter(({ root }) => filePath.startsWith(root))
      .sort((a, b) => b.root.length - a.root.length)[0];
    return match ? match.root : null;
  }

  /**
   * Resolves an import string to a definitive file path found in the project index.
   *
   * @param fromPath - The project-root path of the file containing the import.
   * @param importPath - The raw string value of the import source.
   * @param errors - A collection for reporting resolution failures.
   * @returns The resolved project-root path, or null if unresolvable.
   */
  public resolve(fromPath: string, importPath: string, errors: string[]): string | null {
    const cacheKey = `${fromPath}|${importPath}`;
    if (this.resolutionCache.has(cacheKey)) {
      return this.resolutionCache.get(cacheKey)!;
    }

    const importPathWithoutExt = importPath.replace(/\.(ts|tsx|js|jsx)$/, '');
    let resolvedPath: string | null = null;
    
    // 1. Try Alias Resolution (e.g. @prism/web -> packages/web)
    for (const alias in this.aliasMap) {
      if (importPathWithoutExt.startsWith(alias)) {
        const aliasTarget = this.aliasMap[alias];
        const remainingPath = importPathWithoutExt.substring(alias.length);
        resolvedPath = path.normalize(path.join(aliasTarget, remainingPath));
        break; 
      }
    }
    
    // 2. Try Relative Resolution
    if (!resolvedPath) {
      if (importPathWithoutExt.startsWith('.')) {
        const fromDir = fromPath.substring(0, fromPath.lastIndexOf('/'));
        // We resolve the physical path based on the directory of the importer.
        resolvedPath = path.normalize(path.join(fromDir, importPathWithoutExt));

        // NOTE: We no longer block cross-package relative imports here.
        // The Slicer's mission is to accurately map the existing code graph,
        // not to enforce monorepo "best practices" or linting rules.
      } else {
        // External or unaliased module (e.g. 'react', 'lodash')
        this.resolutionCache.set(cacheKey, null);
        return null;
      }
    }

    // 3. Match against physical candidates (Extensions and Index patterns)
    const extensions = ['.ts', '.tsx', '.js', '.jsx', ''];
    const attempts = extensions.flatMap(ext => [
      `${resolvedPath}${ext}`, 
      `${resolvedPath}/index${ext}`,
    ]);

    for (const attempt of attempts) {
      if (this.filePaths.has(attempt)) {
        this.resolutionCache.set(cacheKey, attempt);
        return attempt;
      }
    }

    this.resolutionCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Internal browser-safe path utility to prevent Node.js 'path' dependency.
 */
const path = {
  join: (...parts: string[]): string => {
    return parts.join('/');
  },
  normalize: (p: string): string => {
    const parts = p.split('/');
    const stack: string[] = [];
    for (const part of parts) {
      if (part === '.' || part === '') continue;
      if (part === '..') {
        if (stack.length > 0) {
          stack.pop();
        }
      } else {
        stack.push(part);
      }
    }
    return stack.join('/');
  }
};