/**
 * @file packages/core/src/hooks/useDebouncedValue.ts
 * @stamp {"ts":"2026-02-16T13:55:00Z"}
 * @architectural-role Utility Hook
 * @description
 * Provides a debounced version of a value. Useful for delaying expensive 
 * operations like API calls or complex graph traversals until a user 
 * has finished an input sequence.
 *
 * @core-principles
 * 1. IS a pure synchronization utility.
 * 2. ENFORCES temporal decoupling between input and processing.
 * 3. MUST handle cleanup of timers to prevent memory leaks or stale updates.
 *
 * @api-declaration
 *   export function useDebouncedValue<T>(value: T, delay: number): T;
 *
 * @contract
 *   assertions:
 *     purity: mutates # Uses internal timers.
 *     state_ownership: [debouncedValue]
 *     external_io: none
 */

import { useState, useEffect } from 'react';

/**
 * @id packages/core/src/hooks/useDebouncedValue.ts#useDebouncedValue
 * @description
 * Returns a value that only updates after the specified delay has passed 
 * without the source value changing.
 * 
 * @param value - The raw state value to debounce.
 * @param delay - The time in milliseconds to wait.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancel the timeout if value changes (or on unmount)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}