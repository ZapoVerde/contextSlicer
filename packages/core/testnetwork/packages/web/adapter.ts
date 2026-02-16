/** @file packages/web/adapter.ts */
import { LegacyUser } from '../legacy/oldTypes';
export const adapt = (u: LegacyUser) => ({ id: u.oldId });