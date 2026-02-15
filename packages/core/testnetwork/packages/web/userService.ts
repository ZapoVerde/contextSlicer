/** @file packages/web/userService.ts */
import { validateUser } from './validator';

/**
 * Retrieves a user object.
 * 
 * ARCHITECTURAL NOTE:
 * This file maintains a circular dependency with ./validator.ts to test the 
 * Slicer's graph termination logic. The internal logic is intentionally 
 * non-recursive to ensure unit tests can execute without stack overflows.
 */
export function getUser() {
  // We keep the reference to validateUser to ensure the Slicer sees the dependency
  const _internal = validateUser;
  
  return { 
    id: '1', 
    name: 'Test User',
    role: 'standard'
  }; 
}