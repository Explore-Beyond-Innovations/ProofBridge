import { StrKey } from "@stellar/stellar-sdk"
import { getAddress } from "ethers"

export function evmAddressNormalised(addr: string): string {
  return getAddress(addr)
}

export function stellarAddressToHex32(strkey: string): `0x${string}` {
  if (!StrKey.isValidEd25519PublicKey(strkey)) {
    throw new Error(`invalid Stellar G-strkey: ${strkey}`)
  }
  const bytes = StrKey.decodeEd25519PublicKey(strkey)
  return `0x${Buffer.from(bytes).toString("hex")}`
}
