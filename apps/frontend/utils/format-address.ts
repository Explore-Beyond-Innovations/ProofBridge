import type { ChainKind } from "@/types/chains"
import { hex32ToAccountId, isStellarAccountId } from "./stellar/address"
import { truncateString } from "./truncate-string"

// Addresses come off the backend in canonical storage form:
//   EVM     — 20-byte 0x hex (EIP-55 / lowercased).
//   STELLAR — 32-byte 0x hex payload of the ed25519 public key.
// Render them as the user expects: EVM stays as 0x… ; Stellar becomes G….
export function formatChainAddress(
  value: string | null | undefined,
  chainKind?: ChainKind,
): string {
  if (!value) return ""
  if (chainKind === "STELLAR") {
    try {
      return hex32ToAccountId(value)
    } catch {
      return value
    }
  }
  if (chainKind === "EVM") return value
  // Infer from shape when chainKind isn't known at the call site.
  if (isStellarAccountId(value)) return value
  const hex = value.replace(/^0x/i, "")
  if (hex.length === 64) {
    try {
      return hex32ToAccountId(value)
    } catch {
      return value
    }
  }
  return value
}

export function formatChainAddressShort(
  value: string | null | undefined,
  chainKind?: ChainKind,
  head = 4,
  tail = 4,
): string {
  return truncateString(formatChainAddress(value, chainKind), head, tail)
}
