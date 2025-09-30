/**
 * @file src/features/sourceDump/hooks/useDevFileWatcher.ts
 * @architectural-role Custom Hook / Development Sensor
 *
 * @description This hook provides an independent, real-time signal for file system
 * changes during development. It directly taps into the Vite development server's
 * Hot Module Replacement (HMR) WebSocket to listen for file update events.
 *
 * @responsibilities
 * 1.  **HMR Listening:** It sets up a listener for Vite's `vite:beforeUpdate` event,
 *     which fires the moment the server detects a change to any file.
 * 2.  **State Management:** It maintains a single piece of state: the `Date` object
 *     representing the timestamp of the last detected file save.
 * 3.  **Development Only:** The entire logic is wrapped in a check for
 *     `import.meta.hot`, ensuring it has zero effect on a production build.
 * 4.  **Clean-up:** It properly removes the event listener when the component using
 *     the hook unmounts.
 *
 * @purpose This hook serves as the "Filesystem Heartbeat" for the staleness detector.
 * It provides the initial trigger that a change has occurred.
 */
import { useState, useEffect } from 'react';

/**
 * A development-only hook that listens for file changes via Vite's HMR WebSocket.
 * @returns The Date object of the last detected file save, or null if none.
 */
export function useDevFileWatcher(): Date | null {
  const [lastSaveTimestamp, setLastSaveTimestamp] = useState<Date | null>(null);

  useEffect(() => {
    if (import.meta.hot) {
      const handleUpdate = () => {
        // We only care that *a* save happened. We don't need to inspect the payload.
        setLastSaveTimestamp(new Date());
      };

      import.meta.hot.on('vite:beforeUpdate', handleUpdate);

      return () => {
        import.meta.hot?.off('vite:beforeUpdate', handleUpdate);
      };
    }
  }, []);

  return lastSaveTimestamp;
}