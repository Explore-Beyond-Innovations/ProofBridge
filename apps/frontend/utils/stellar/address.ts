import { StrKey } from "@stellar/stellar-sdk"

const HEX32_RE = /^0x[a-fA-F0-9]{64}$/
const HEX20_RE = /^0x[a-fA-F0-9]{40}$/

export function hex32ToBuffer(hex: string): Buffer {
  if (HEX32_RE.test(hex)) return Buffer.from(hex.slice(2), "hex")
  if (HEX20_RE.test(hex)) {
    const clean = hex.slice(2).toLowerCase()
    return Buffer.from("00".repeat(12) + clean, "hex")
  }
  throw new Error(
    `invalid bytes32-or-evm hex address: ${hex} (want 0x + 40 or 64 hex chars)`,
  )
}

// Strict 32-byte-only variant. Use this for StrKey encodes (account ids,
// contract ids) where zero-padding an EVM 20-byte address would silently
// produce a bogus Ed25519/contract strkey.
function hex32OnlyToBuffer(hex: string): Buffer {
  if (!HEX32_RE.test(hex)) {
    throw new Error(
      `expected 0x + 64 hex (32 bytes), got ${hex} — EVM addresses are not valid Stellar keys`,
    )
  }
  return Buffer.from(hex.slice(2), "hex")
}

export function bufferToHex32(buf: Buffer): `0x${string}` {
  if (buf.length !== 32) throw new Error("bufferToHex32: expected 32 bytes")
  return `0x${buf.toString("hex")}`
}

export function hex32ToContractId(hex: string): string {
  return StrKey.encodeContract(hex32OnlyToBuffer(hex))
}

export function hex32ToAccountId(hex: string): string {
  return StrKey.encodeEd25519PublicKey(hex32OnlyToBuffer(hex))
}

export function contractIdToHex32(strkey: string): `0x${string}` {
  return bufferToHex32(Buffer.from(StrKey.decodeContract(strkey)))
}

export function accountIdToHex32(strkey: string): `0x${string}` {
  return bufferToHex32(Buffer.from(StrKey.decodeEd25519PublicKey(strkey)))
}

export function isStellarAccountId(value: string): boolean {
  return StrKey.isValidEd25519PublicKey(value)
}

export function isStellarContractId(value: string): boolean {
  return StrKey.isValidContract(value)
}
