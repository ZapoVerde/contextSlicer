/** @file packages/web/userService.ts */
import { validateUser } from './validator';
export function getUser() { 
  return validateUser({ id: '1' }); 
}