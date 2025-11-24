/**
 * @file src/features/sourceDump/hooks/useFreshnessStatus.ts
 * @architectural-role Custom Hook / State Machine & Automation Logic
 *
 * @description This hook is the central logic hub for the "Staleness Detector". It
 * implements a timer-based recovery system to provide a simple, actionable status
 * on the freshness of the loaded source dump and to automate recovery from a stale state.
 *
 * @responsibilities
 * 1.  **Data Aggregation:** It subscribes to the `useZipStore` to get the data source
 *     type, the dump's generation timestamp, and the `reset` action for refetching.
 * 2.  **Automated Recovery:** It uses the `useDevFileWatcher` hook to detect when a
 *     source file has been saved.
 *     - Upon detecting a new save, it immediately enters the 'Stale' state.
 *     - It then starts a short timer (e.g., 2.5 seconds).
 *     - When the timer completes, it automatically calls the `reset` action on the
 *       `useZipStore`, which re-fetches the data and returns the system to a 'Synced' state.
 * 3.  **State Derivation:** It performs the business logic of comparing timestamps to
 *     determine the current `isStale` status for the UI.
 * 4.  **Simple Interface:** It returns a clean, memoized object that all UI components
 *     can use to react to the current freshness status.
 */
import { useMemo, useEffect } from 'react';
import { useZipStore } from '../state/useZipStore';
import { useDevFileWatcher } from './useDevFileWatcher';

export interface FreshnessStatus {
  isStale: boolean;
  showTimestamps: boolean;
  generatedAt: Date | null;
  lastSave: Date | null;
  source: 'dev' | 'zip' | 'none';
}

const REFETCH_DELAY_MS = 2500; // 2.5 second delay

/**
 * The central logic hook for determining and recovering from a stale data state.
 * @returns A `FreshnessStatus` object.
 */
export function useFreshnessStatus(): FreshnessStatus {
  const source = useZipStore(state => state.source);
  const manifest = useZipStore(state => state.manifest);
  const reset = useZipStore(state => state.reset);
  const lastSave = useDevFileWatcher();

  const generatedAt = useMemo(
    () => (manifest?.generatedAt ? new Date(manifest.generatedAt) : null),
    [manifest]
  );

  const isStale = useMemo(() => {
    return (
      source === 'dev' &&
      generatedAt instanceof Date &&
      lastSave instanceof Date &&
      lastSave > generatedAt
    );
  }, [source, generatedAt, lastSave]);

  useEffect(() => {
    // If we are in a stale state, trigger the automated recovery.
    if (isStale) {
      const timer = setTimeout(() => {
        reset();
      }, REFETCH_DELAY_MS);

      // Clean up the timer if the component unmounts or dependencies change. 
      return () => clearTimeout(timer);
    }
  }, [isStale, reset]);

  return useMemo(() => {
    const showTimestamps = source === 'dev' && !!generatedAt;

    return {
      isStale,
      showTimestamps,
      generatedAt,
      lastSave,
      source,
    };
  }, [isStale, generatedAt, lastSave, source]);
}