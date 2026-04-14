import { parseUnits } from "viem"
import type { ChainKind } from "@/types/chains"

export const DEFAULT_DECIMALS: Record<ChainKind, number> = {
  EVM: 18,
  STELLAR: 7,
}

export function toBaseUnits(
  amount: string,
  chainKind: ChainKind,
  decimals: number = DEFAULT_DECIMALS[chainKind],
): string {
  return parseUnits(amount, decimals).toString()
}
