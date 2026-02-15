/** @file packages/web/userService.spec.ts */
import { getUser } from './userService';
test('getUser', () => { expect(getUser()).toBeDefined(); });