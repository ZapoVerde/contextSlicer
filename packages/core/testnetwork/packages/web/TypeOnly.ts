/** @file packages/web/TypeOnly.ts */
import type { User } from '../shared-types/inheritance';
export const processUser = (u: User) => u.email;