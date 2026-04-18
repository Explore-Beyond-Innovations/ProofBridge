import type { T_OrderParams } from '../../../chain-adapters/types';

// Builds the human-readable message shown in Stellar wallets (Freighter etc.)
// when the user signs an unlock authorization. Stellar wallets don't have a
// typed-data UI like EIP-712, so we send a pretty-printed JSON of the order
// fields — the wallet renders the exact UTF-8 bytes, which the user can eyeball
// before approving.
//
// MUST stay byte-identical to the frontend's
// `apps/frontend/utils/stellar/unlock-message.ts` — the backend rebuilds this
// string from the trade record and verifies the ed25519 signature against its
// UTF-8 bytes.
export function buildStellarUnlockMessage(p: T_OrderParams & {
  orderHash: string;
}): string {
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
