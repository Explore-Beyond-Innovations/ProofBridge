import { StrKey, nativeToScVal, xdr } from "@stellar/stellar-sdk"
import type { AdManagerOrderParams } from "../api/trades.js"

const HEX32_RE = /^0x[a-fA-F0-9]{64}$/

function hex32ToBuffer(hex: string): Buffer {
  if (!HEX32_RE.test(hex)) {
    throw new Error(`expected 0x + 64 hex (32 bytes), got ${hex}`)
  }
  return Buffer.from(hex.slice(2), "hex")
}

export function hex32ToContractId(hex: string): string {
  return StrKey.encodeContract(hex32ToBuffer(hex))
}

export function bytesN(hex: string): xdr.ScVal {
  return nativeToScVal(hex32ToBuffer(hex), { type: "bytes" })
}

export function bytes(buf: Buffer): xdr.ScVal {
  return nativeToScVal(buf, { type: "bytes" })
}

export function u32(n: number): xdr.ScVal {
  return nativeToScVal(n, { type: "u32" })
}

export function u64(n: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(n), { type: "u64" })
}

export function u128(n: string | bigint | number): xdr.ScVal {
  return nativeToScVal(BigInt(n), { type: "u128" })
}

export function strVal(s: string): xdr.ScVal {
  return nativeToScVal(s, { type: "string" })
}

export function authArgs(
  signatureHex: string,
  publicKeyHex: string,
  authTokenHex: string,
  timeToExpire: number,
): xdr.ScVal[] {
  return [
    bytes(Buffer.from(signatureHex.replace(/^0x/, ""), "hex")),
    bytesN(publicKeyHex),
    bytesN(authTokenHex),
    u64(timeToExpire),
  ]
}

export function orderParamsScVal(p: AdManagerOrderParams): xdr.ScVal {
  const entries: Array<[string, xdr.ScVal]> = [
    ["ad_chain_token", bytesN(p.adChainToken)],
    ["ad_creator", bytesN(p.adCreator)],
    ["ad_decimals", u32(p.adDecimals)],
    ["ad_id", strVal(p.adId)],
    ["ad_recipient", bytesN(p.adRecipient)],
    ["amount", u128(p.amount)],
    ["bridger", bytesN(p.bridger)],
    ["order_chain_id", u128(p.orderChainId)],
    ["order_chain_token", bytesN(p.orderChainToken)],
    ["order_decimals", u32(p.orderDecimals)],
    ["order_recipient", bytesN(p.orderRecipient)],
    ["salt", u128(p.salt)],
    ["src_order_portal", bytesN(p.srcOrderPortal)],
  ]
  return xdr.ScVal.scvMap(
    entries.map(
      ([k, v]) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: v }),
    ),
  )
}
