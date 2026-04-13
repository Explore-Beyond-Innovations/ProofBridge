import { Address } from "viem"
import type { ChainKind } from "./chains"
import type { TokenKind } from "./tokens"

export interface ICreateAdRequest {
  routeId: string
  creatorDstAddress: string
  fundAmount: string
  minAmount?: string
  maxAmount?: string
  metadata: {
    title: string
    description: string
  }
}

export interface ICreateAdResponse {
  contractAddress: Address
  signature: Address
  signerPublicKey?: Address
  authToken: Address
  timeToExpire: number
  adId: string
  adToken: Address
  orderChainId: string
  adRecipient: Address
  reqHash: Address
  chainId: number
  chainKind: ChainKind
}

export interface IFundAdResponse {
  contractAddress: Address
  signature: Address
  signerPublicKey?: Address
  authToken: Address
  timeToExpire: number
  adId: string
  adToken: Address
  orderChainId: string
  adRecipient: Address
  reqHash: Address
  chainId: number
  amount: number
  chainKind: ChainKind
}

export interface ITopUpAdRequest {
  adId: string
  poolAmountTopUp: string
  amountBigInt: bigint
  tokenId: string
}

export interface IWithdrawFromAdRequest {
  adId: string
  poolAmountWithdraw: string
  amountBigInt: bigint
  to: string
}

export interface IWithdrawFromAdResponse {
  chainId: string
  contractAddress: Address
  signature: Address
  signerPublicKey?: Address
  authToken: Address
  timeToExpire: number
  adId: string
  amount: string
  to: Address
  reqHash: Address
  chainKind: ChainKind
}

export interface ICloseAdRequest {
  adId: string
  to: string
}

export interface ICloseAdResponse {
  chainId: string
  contractAddress: Address
  signature: Address
  signerPublicKey?: Address
  authToken: Address
  timeToExpire: number
  adId: string
  amount: string
  to: Address
  reqHash: Address
  chainKind: ChainKind
}

export interface IUpdateAdRequest {
  status?: "ACTIVE" | "PAUSED"
  minAmount?: string
  maxAmount?: string
  metadata?: {
    title?: string
    description?: string
  }
  adId: string
}

export interface IUpdateAdResponse {
  id: string
  creatorAddress: string
  minAmount: {}
  maxAmount: {}
  metadata: {}
}

export interface IConfirmAdTxRequest {
  adId: string
  txHash: string
  signature: Address
}

export interface IAd {
  id: string
  creatorAddress: string
  routeId: string
  adTokenId: string
  orderTokenId: string
  poolAmount: string
  availableAmount: string
  minAmount: string
  maxAmount: string
  status: AdStatusT
  metadata: { title?: string; description?: string }
  createdAt: string
  updatedAt: string
  adToken: IAdToken
  orderToken: IAdToken
}

export interface IAdToken {
  name: string
  symbol: string
  address: Address
  decimals: number
  chainId: string
  chainKind: ChainKind
  kind: TokenKind
}

export interface IGetAdsParams {
  creatorAddress?: Address
  routeId?: string
  status?: AdStatusT
  cursor?: string
  limit?: number
  adChainId?: string
  orderChainId?: string
  adTokenId?: string
  orderTokenId?: string
}

export type AdStatusT =
  | "INACTIVE"
  | "ACTIVE"
  | "PAUSED"
  | "EXHAUSTED"
  | "CLOSED"

export type TradeStatusT = "INACTIVE" | "ACTIVE" | "LOCKED" | "COMPLETED"
