import { nativeToScVal, xdr } from "@stellar/stellar-sdk"
import { hex32ToBuffer } from "./address"

export function bytesN(hex: string): xdr.ScVal {
  return nativeToScVal(hex32ToBuffer(hex), { type: "bytes" })
}

export function bytes(buf: Buffer): xdr.ScVal {
  return nativeToScVal(buf, { type: "bytes" })
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

// Shared auth quadruple (signature, public_key, auth_token, time_to_expire).
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

// Matches contracts/stellar/contracts/ad-manager/src/types.rs::OrderParams.
export interface StellarOrderParams {
  orderChainToken: string
  adChainToken: string
  amount: string
  bridger: string
  orderChainId: string
  srcOrderPortal: string
  orderRecipient: string
  adId: string
  adCreator: string
  adRecipient: string
  salt: string
}

// Soroban struct is an ScMap with entries sorted alphabetically by key.
export function orderParamsScVal(p: StellarOrderParams): xdr.ScVal {
  const entries: Array<[string, xdr.ScVal]> = [
    ["ad_chain_token", bytesN(p.adChainToken)],
    ["ad_creator", bytesN(p.adCreator)],
    ["ad_id", strVal(p.adId)],
    ["ad_recipient", bytesN(p.adRecipient)],
    ["amount", u128(p.amount)],
    ["bridger", bytesN(p.bridger)],
    ["order_chain_id", u128(p.orderChainId)],
    ["order_chain_token", bytesN(p.orderChainToken)],
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

// Matches contracts/stellar/contracts/order-portal/src/types.rs::OrderParams.
export interface StellarOrderPortalParams {
  orderChainToken: string
  adChainToken: string
  amount: string
  bridger: string
  orderRecipient: string
  adChainId: string
  adManager: string
  adId: string
  adCreator: string
  adRecipient: string
  salt: string
}

export function orderPortalParamsScVal(
  p: StellarOrderPortalParams,
): xdr.ScVal {
  const entries: Array<[string, xdr.ScVal]> = [
    ["ad_chain_id", u128(p.adChainId)],
    ["ad_chain_token", bytesN(p.adChainToken)],
    ["ad_creator", bytesN(p.adCreator)],
    ["ad_id", strVal(p.adId)],
    ["ad_manager", bytesN(p.adManager)],
    ["ad_recipient", bytesN(p.adRecipient)],
    ["amount", u128(p.amount)],
    ["bridger", bytesN(p.bridger)],
    ["order_chain_token", bytesN(p.orderChainToken)],
    ["order_recipient", bytesN(p.orderRecipient)],
    ["salt", u128(p.salt)],
  ]
  return xdr.ScVal.scvMap(
    entries.map(
      ([k, v]) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: v }),
    ),
  )
}
