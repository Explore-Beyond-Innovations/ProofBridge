import type { T_OrderParams } from '../../../chain-adapters/types';

// Build the human-readable message shown in Stellar wallets (Freighter etc.)
// when the user signs an unlock authorization.
export function buildStellarUnlockMessage(
  p: T_OrderParams & {
    orderHash: string;
  },
): string {
  return JSON.stringify(
    {
      action: 'ProofBridge: Authorize Unlock',
      orderHash: p.orderHash,
      amount: p.amount,
      orderDecimals: p.orderDecimals,
      adDecimals: p.adDecimals,
      orderChainId: p.orderChainId,
      orderChainToken: p.orderChainToken,
      orderPortal: p.orderPortal,
      orderRecipient: p.orderRecipient,
      adChainId: p.adChainId,
      adChainToken: p.adChainToken,
      adManager: p.adManager,
      adRecipient: p.adRecipient,
      bridger: p.bridger,
      adCreator: p.adCreator,
      adId: p.adId,
      salt: p.salt,
    },
    null,
    2,
  );
}
