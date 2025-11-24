/**
 * @file packages/core/src/hooks/useFreshnessStatus.ts
 * @stamp {"ts":"2025-11-24T14:00:00Z"}
 * @architectural-role Custom Hook / State Adapter
 *
 * @description
 * Provides the current freshness status of the data source.
 *
 * Note on Refactor:
 * In the new "Desktop/API" architecture, data is fetched lazily from the disk,
 * so the concept of a "stale dump" is less relevant than in the old "Zip Dump" model.
 * For now, this hook returns a safe default (Not Stale) to ensure the UI works.
 *
 * Future improvements could re-introduce polling against /api/status to detect
 * file system changes in real-time.
 *
 * @contract
 *   assertions:
 *     purity: pure # deriving state from store
 *     state_ownership: none
 */

import { useMemo } from 'react';
import { useSlicerStore } from '../state/useSlicerStore';

export interface FreshnessStatus {
  isStale: boolean;
  showTimestamps: boolean;
  generatedAt: Date | null;
  lastSave: Date | null;
  source: 'none' | 'api' | 'zip';
}

export function useFreshnessStatus(): FreshnessStatus {
  const source = useSlicerStore(state => state.source);

  return useMemo(() => {
    return {
      // In API mode, we read live from disk, so we are never "stale".
      // In Zip mode, we are a static snapshot, so we are also not "stale" relative to the snapshot.
      isStale: false,
      
      showTimestamps: false, // Legacy feature, disabled for now
      generatedAt: new Date(), // Placeholder
      lastSave: null,
      source,
    };
  }, [source]);
}