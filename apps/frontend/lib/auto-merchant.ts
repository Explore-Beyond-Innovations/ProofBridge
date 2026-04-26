import type { ChainKind } from "@/types/chains"
import { accountIdToHex32 } from "@/utils/stellar/address"

const EVM_AUTO_MERCHANT = "0x2E5E4bd4a26C1154d44684D3FAd2C0ee020938BB".toLowerCase()
const STELLAR_AUTO_MERCHANT_HEX32 = accountIdToHex32(
  "GC2NS56PWBAPMYFAFNO6VJWQ2MSWE3YVL5R6K5YZOKU7YKA32WOFUDWK",
).toLowerCase()

export function isAutoMerchant(
  creatorAddress: string | null | undefined,
  chainKind: ChainKind | undefined,
): boolean {
  if (!creatorAddress) return false
  const normalized = creatorAddress.toLowerCase()
  if (chainKind === "EVM") return normalized === EVM_AUTO_MERCHANT
  if (chainKind === "STELLAR") return normalized === STELLAR_AUTO_MERCHANT_HEX32
  return false
}
