/**
 * @file packages/core/testnetwork/packages/web/userService.ts
 * @stamp {"ts":"2026-02-16T23:45:00Z"}
 * @architectural-role Business Logic / Test Data
 * @description
 * Part of the Hardened Prism Network. Provides a service implementation
 * that uses a private local interface in its public signature to test
 * non-exported type discovery (Omniscient Mining).
 */

import { validateUser } from './validator';

/**
 * PRIVATE INTERFACE
 * This is not exported. It must be discovered by the Omniscient Miner
 * because it is referenced in the signature of the exported getUser function.
 */
interface UserInternalConfig {
  /** Maximum number of retries for the fetch operation. */
  retries: number;
  /** Timeout in milliseconds. */
  timeout?: number;
}

/**
 * Retrieves a user object.
 * 
 * ARCHITECTURAL NOTE:
 * This file maintains a circular dependency with ./validator.ts to test the 
 * Slicer's graph termination logic.
 * 
 * @param config - The internal configuration (private type).
 */
export function getUser(config: UserInternalConfig) {
  // We keep the reference to validateUser to ensure the Slicer sees the dependency
  const _internal = validateUser;
  
  return { 
    id: '1', 
    name: 'Test User',
    role: 'standard',
    retries: config.retries
  }; 
}