/** @file packages/web/userService.spec.ts */
import { getUser } from './userService';

test('getUser', () => { 
  // FIX: Provide required config object to satisfy the new signature
  const user = getUser({ retries: 3 });
  expect(user).toBeDefined(); 
  expect(user.retries).toBe(3);
});