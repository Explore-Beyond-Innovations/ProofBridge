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

export function bufferToHex32(buf: Buffer): `0x${string}` {
  if (buf.length !== 32) throw new Error("bufferToHex32: expected 32 bytes")
  return `0x${buf.toString("hex")}`
}

export function hex32ToContractId(hex: string): string {
  return StrKey.encodeContract(hex32ToBuffer(hex))
}

export function hex32ToAccountId(hex: string): string {
  return StrKey.encodeEd25519PublicKey(hex32ToBuffer(hex))
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
