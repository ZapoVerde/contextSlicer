/** @file packages/web/ScentChainC.ts */
import { ScentChainD } from './ScentChainD';
export const ScentChainC = (account: any) => {
  const { account: profile } = { account };
  return ScentChainD(profile);
};