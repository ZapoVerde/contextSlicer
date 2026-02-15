/** @file packages/web/validator.ts */
import { getUser } from './userService';
export function validateUser(u: any) { 
  return u.id ? getUser() : null; 
}