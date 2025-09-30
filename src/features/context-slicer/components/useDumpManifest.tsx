/**
 * @file src/features/context-slicer/components/useDumpManifest.tsx
 * @stamp {"ts":"2025-09-28T18:24:00Z"}
 * @architectural-role Custom Hook / Data Selector
 *
 * @description
 * This hook provides a simple and memoized way to access metadata from the
 * main `dumpManifest` object stored in the `useZipStore`. Its primary purpose is
 * to resolve the relative URLs from the manifest into absolute, root-relative
 * paths that can be used in component `href` links.
 *
 * @contract
 * State Ownership: This component is stateless. It is a pure selector of state
 * that is owned by `useZipStore`.
 * Public API: `useDumpManifest()`. Returns an object containing `loading`, `error`,
 * `generatedAt`, `concatTxtUrl`, and `concatZipUrl`.
 * Core Invariants:
 *   - MUST correctly resolve relative URL fragments from the manifest against the `dumpBase`.
 *   - MUST only return URLs when the `source` is 'dev', as global artifact URLs are
 *     not relevant when viewing a user-uploaded zip file.
 *
 * @core-principles
 * 1. **Selector Pattern:** Decouples consuming components from the specific shape
 *    of the `useZipStore`, providing a stable, curated API for manifest data.
 * 2. **Memoization:** Uses `useMemo` to ensure its returned object is stable,
 *    preventing unnecessary re-renders in components that consume it.
 * 3. **Single Responsibility:** Its sole purpose is to select, format, and provide
 *    metadata from the loaded manifest.
 */
import { useMemo } from 'react';
import { useZipStore } from '../state/useZipStore';
import type { DumpManifest } from '../state/zip-state';

export type { DumpManifest };

/**
 * Resolves a URL fragment against a base path.
 */
function resolveUrl(base: string, fragment?: string | null): string | null {
  if (!fragment) return null;
  // If fragment is already absolute, return it as-is.
  if (/^https?:\/\//i.test(fragment) || fragment.startsWith('/')) {
    return fragment;
  }
  const sep = base.endsWith('/') ? '' : '/';
  return `${base}${sep}${fragment}`;
}

export function useDumpManifest() {
  const { manifest, source, status, error } = useZipStore();

  return useMemo(() => {
    const loading = status === 'loading';
    const hookError = status === 'error' ? error || 'An unknown error occurred.' : null;

    if (!manifest) {
      return {
        loading,
        error: hookError,
        generatedAt: undefined,
        concatTxtUrl: undefined,
        concatZipUrl: undefined,
      };
    }

    const isDev = source === 'dev';

    const fullConcatTxtUrl = isDev ? resolveUrl(manifest.dumpBase, manifest.concatTxt) : undefined;
    const fullConcatZipUrl = isDev
      ? resolveUrl(manifest.dumpBase, manifest.concatZip || null)
      : undefined;

    return {
      loading,
      error: hookError,
      generatedAt: manifest.generatedAt,
      concatTxtUrl: fullConcatTxtUrl || undefined,
      concatZipUrl: fullConcatZipUrl || undefined,
    };
  }, [manifest, source, status, error]);
}