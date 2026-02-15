/**
 * @file packages/core/src/logic/symbolGraph/boundaryScanner/importResolver.ts
 * @stamp {"ts":"2026-02-15T12:05:00Z"}
 * @architectural-role Business Logic / Utility
 * @description
 * Provides resolution logic for relative import paths. It transforms a relative 
 * source string (e.g., '../../utils') into an absolute project-root key by 
 * simulating directory traversal and checking against common script extensions 
 * and index file patterns.
 * 
 * @core-principles
 * 1. IS a pure, stateless resolution engine.
 * 2. OWNS the heuristic for identifying script file candidates (extensions/index files).
 * 3. MUST NOT perform I/O; relies strictly on the provided fileIndex keys.
 * 
 * @api-declaration
 *   export function resolveImportPath(
 *     currentFile: string,
 *     importSource: string,
 *     fileIndex: Map<string, unknown>
 *   ): string | null;
 * 
 * @contract
 *   assertions:
 *     purity: pure
 *     external_io: none
 */

/**
 * Ordered list of candidate extensions and index patterns.
 * Priority is given to direct file matches before directory index resolution.
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
   * @id packages/core/src/logic/symbolGraph/boundaryScanner/importResolver.ts#resolveImportPath
   * @description
   * Resolves a relative import path to a project-root key. 
   * Supports parent directory stepping ('../') and current directory referencing ('./').
   * 
   * @param currentFile - The absolute project path of the file containing the import.
   * @param importSource - The raw string value of the import source (e.g., "./my-module").
   * @param fileIndex - The registry of all existing files in the project.
   */
  export function resolveImportPath(
    currentFile: string,
    importSource: string,
    fileIndex: Map<string, unknown>
  ): string | null {
    const stack = currentFile.split('/');
    stack.pop(); // Remove the filename to get the directory context
  
    const parts = importSource.split('/');
    
    for (const part of parts) {
      if (part === '.') {
        continue;
      }
      
      if (part === '..') {
        if (stack.length > 0) {
          stack.pop();
        }
        continue;
      }
      
      stack.push(part);
    }
  
    const basePath = stack.join('/');
    
    // 1. Check for a direct match (e.g., if the import included the extension)
    if (fileIndex.has(basePath)) {
      return basePath;
    }
  
    // 2. Iterate through candidate extensions and index patterns
    for (const ext of RESOLUTION_CANDIDATES) {
      const candidate = `${basePath}${ext}`;
      if (fileIndex.has(candidate)) {
        return candidate;
      }
    }
  
    return null;
  }