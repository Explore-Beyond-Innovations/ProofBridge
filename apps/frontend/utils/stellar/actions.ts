import { Address } from "@stellar/stellar-sdk"
import { invokeSoroban, type StellarSignFn } from "./invoke"
import {
  StellarOrderParams,
  StellarOrderPortalParams,
  authArgs,
  bytes,
  bytesN,
  orderParamsScVal,
  orderPortalParamsScVal,
  strVal,
  u128,
} from "./scval"

export interface StellarAdapterCtx {
  rpcUrl: string
  networkPassphrase?: string
  signerPublicKey: string
  signTransaction: StellarSignFn
}

interface AuthQuad {
  signatureHex: string
  signerPublicKeyHex: string
  authTokenHex: string
  timeToExpire: number
}

export async function createAdSoroban(
  ctx: StellarAdapterCtx,
  auth: AuthQuad,
  params: {
    creatorPublicKey: string // G-strkey
    adId: string
    adTokenHex: string
    initialAmount: string
    orderChainId: string
    adRecipientHex: string
    adManagerHex: string
  },
): Promise<string> {
  const args = [
    ...authArgs(
      auth.signatureHex,
      auth.signerPublicKeyHex,
      auth.authTokenHex,
      auth.timeToExpire,
    ),
    new Address(params.creatorPublicKey).toScVal(),
    strVal(params.adId),
    bytesN(params.adTokenHex),
    u128(params.initialAmount),
    u128(params.orderChainId),
    bytesN(params.adRecipientHex),
  ]
  return invokeSoroban({
    ...ctx,
    contractHex: params.adManagerHex,
    method: "create_ad",
    args,
  })
}

export async function fundAdSoroban(
  ctx: StellarAdapterCtx,
  auth: AuthQuad,
  params: { adId: string; amount: string; adManagerHex: string },
): Promise<string> {
  const args = [
    ...authArgs(
      auth.signatureHex,
      auth.signerPublicKeyHex,
      auth.authTokenHex,
      auth.timeToExpire,
    ),
    strVal(params.adId),
    u128(params.amount),
  ]
  return invokeSoroban({
    ...ctx,
    contractHex: params.adManagerHex,
    method: "fund_ad",
    args,
  })
}

export async function withdrawFromAdSoroban(
  ctx: StellarAdapterCtx,
  auth: AuthQuad,
  params: {
    adId: string
    amount: string
    toPublicKey: string // G-strkey
    adManagerHex: string
  },
): Promise<string> {
  const args = [
    ...authArgs(
      auth.signatureHex,
      auth.signerPublicKeyHex,
      auth.authTokenHex,
      auth.timeToExpire,
    ),
    strVal(params.adId),
    u128(params.amount),
    new Address(params.toPublicKey).toScVal(),
  ]
  return invokeSoroban({
    ...ctx,
    contractHex: params.adManagerHex,
    method: "withdraw_from_ad",
    args,
  })
}

export async function closeAdSoroban(
  ctx: StellarAdapterCtx,
  auth: AuthQuad,
  params: { adId: string; toPublicKey: string; adManagerHex: string },
): Promise<string> {
  const args = [
    ...authArgs(
      auth.signatureHex,
      auth.signerPublicKeyHex,
      auth.authTokenHex,
      auth.timeToExpire,
    ),
    strVal(params.adId),
    new Address(params.toPublicKey).toScVal(),
  ]
  return invokeSoroban({
    ...ctx,
    contractHex: params.adManagerHex,
    method: "close_ad",
    args,
  })
}

export async function lockForOrderSoroban(
  ctx: StellarAdapterCtx,
  auth: AuthQuad,
  params: { orderParams: StellarOrderParams; adManagerHex: string },
): Promise<string> {
  const args = [
    ...authArgs(
      auth.signatureHex,
      auth.signerPublicKeyHex,
      auth.authTokenHex,
      auth.timeToExpire,
    ),
    orderParamsScVal(params.orderParams),
  ]
  return invokeSoroban({
    ...ctx,
    contractHex: params.adManagerHex,
    method: "lock_for_order",
    args,
  })
}

export async function unlockSoroban(
  ctx: StellarAdapterCtx,
  auth: AuthQuad,
  params: {
    orderParams: StellarOrderParams
    nullifierHashHex: string
    targetRootHex: string
    proof: Buffer
    adManagerHex: string
  },
): Promise<string> {
  const args = [
    ...authArgs(
      auth.signatureHex,
      auth.signerPublicKeyHex,
      auth.authTokenHex,
      auth.timeToExpire,
    ),
    orderParamsScVal(params.orderParams),
    bytesN(params.nullifierHashHex),
    bytesN(params.targetRootHex),
    bytes(params.proof),
  ]
  return invokeSoroban({
    ...ctx,
    contractHex: params.adManagerHex,
    method: "unlock",
    args,
  })
}

export async function createOrderSoroban(
  ctx: StellarAdapterCtx,
  auth: AuthQuad,
  params: {
    orderParams: StellarOrderPortalParams
    orderPortalHex: string
  },
): Promise<string> {
  const args = [
    ...authArgs(
      auth.signatureHex,
      auth.signerPublicKeyHex,
      auth.authTokenHex,
      auth.timeToExpire,
    ),
    orderPortalParamsScVal(params.orderParams),
  ]
  return invokeSoroban({
    ...ctx,
    contractHex: params.orderPortalHex,
    method: "create_order",
    args,
  })
}

export async function unlockOrderPortalSoroban(
  ctx: StellarAdapterCtx,
  auth: AuthQuad,
  params: {
    orderParams: StellarOrderPortalParams
    nullifierHashHex: string
    targetRootHex: string
    proof: Buffer
    orderPortalHex: string
  },
): Promise<string> {
  const args = [
    ...authArgs(
      auth.signatureHex,
      auth.signerPublicKeyHex,
      auth.authTokenHex,
      auth.timeToExpire,
    ),
    orderPortalParamsScVal(params.orderParams),
    bytesN(params.nullifierHashHex),
    bytesN(params.targetRootHex),
    bytes(params.proof),
  ]
  return invokeSoroban({
    ...ctx,
    contractHex: params.orderPortalHex,
    method: "unlock",
    args,
  })
}
