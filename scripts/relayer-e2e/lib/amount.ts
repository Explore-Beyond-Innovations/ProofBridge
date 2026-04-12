// Chain-aware base-unit formatter — mirrors apps/backend-relayer/test/setups/amount.ts.

import { parseUnits } from "viem";

export type ChainKind = "EVM" | "STELLAR";

export const DEFAULT_DECIMALS: Record<ChainKind, number> = {
  EVM: 18,
  STELLAR: 7,
};

export function toBaseUnits(
  amount: string,
  chainKind: ChainKind,
  decimals: number = DEFAULT_DECIMALS[chainKind]
): string {
  return parseUnits(amount, decimals).toString();
}
