import { getAddress } from "viem"

// Cross-chain wire format uses bytes32. For EVM tokens/addresses this is the
// 20-byte address left-padded with 12 zero bytes. This peels it back out.
export function hex32ToAddress20(hex: string): `0x${string}` {
  const clean = hex.replace(/^0x/, "")
  if (clean.length !== 64) {
    throw new Error(`hex32ToAddress20: expected 32-byte hex, got ${hex}`)
  }
  return getAddress(`0x${clean.slice(-40)}`)
}

// Left-pad a 20-byte EVM address to 32 bytes. Passes 32-byte input through.
export function toBytes32(value: string): `0x${string}` {
  const hex = value.replace(/^0x/i, "").toLowerCase()
  if (hex.length === 64) return `0x${hex}`
  if (hex.length === 40) return `0x${"0".repeat(24)}${hex}`
  throw new Error(`toBytes32: expected 20- or 32-byte hex, got ${value}`)
}
