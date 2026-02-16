/** @file packages/web/validator.ts */
import { getUser } from './userService';

/**
 * Validates a user object.
 * 
 * ARCHITECTURAL NOTE:
 * This file maintains a circular dependency with ./userService.ts to test the 
 * Slicer's graph termination logic. The internal logic is intentionally 
 * non-recursive to ensure unit tests can execute without stack overflows.
 */
export function validateUser(u: any) {
  // We keep the reference to getUser to ensure the Slicer sees the dependency
  const _internal = getUser;
  
  // Return a simple validation result instead of recursing
  return u && u.id ? u : null;
}