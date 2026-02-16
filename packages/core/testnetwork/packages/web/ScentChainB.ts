/** @file packages/web/ScentChainB.ts */
import { ScentChainC } from './ScentChainC';
export const ScentChainB = (user: any) => {
  const account = user;
  return ScentChainC(account);
};