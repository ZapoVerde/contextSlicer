/**
 * @file packages/context-slicer-app/src/features/context-slicer/logic/symbolGraph/pathResolver.ts
 * @stamp {"ts":"2025-09-29T08:30:00Z"}
 * @architectural-role Logic Utility / Dynamic Module Resolver
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

  private getPackageRoot(filePath: string): string | null {
    const match = this.packageRoots
      .filter(({ root }) => filePath.startsWith(root))
      .sort((a, b) => b.root.length - a.root.length)[0];
    return match ? match.root : null;
  }

  public resolve(fromPath: string, importPath: string, errors: string[]): string | null {
    const cacheKey = `${fromPath}|${importPath}`;
    if (this.resolutionCache.has(cacheKey)) {
      return this.resolutionCache.get(cacheKey)!;
    }

    const importPathWithoutExt = importPath.replace(/\.(ts|tsx|js|jsx)$/, '');
    let resolvedPath: string | null = null;
    
    for (const alias in this.aliasMap) {
      if (importPathWithoutExt.startsWith(alias)) {
        const aliasTarget = this.aliasMap[alias];
        const remainingPath = importPathWithoutExt.substring(alias.length);
        resolvedPath = path.normalize(path.join(aliasTarget, remainingPath));
        break; 
      }
    }
    
    if (!resolvedPath) {
      if (importPathWithoutExt.startsWith('.')) {
        const fromDir = fromPath.substring(0, fromPath.lastIndexOf('/'));
        const candidatePath = path.normalize(path.join(fromDir, importPathWithoutExt));

        const fromPackage = this.getPackageRoot(fromPath);
        const toPackage = this.getPackageRoot(candidatePath);

        if (fromPackage && toPackage && fromPackage !== toPackage) {
          errors.push(
            `[Invalid Import] File '${fromPath}' cannot use a relative path to import from another package: '${importPath}'. Use an alias instead.`
          );
          this.resolutionCache.set(cacheKey, null);
          return null;
        }
        resolvedPath = candidatePath;
      } else {
        this.resolutionCache.set(cacheKey, null);
        return null;
      }
    }

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

// A robust, browser-safe path utility.
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