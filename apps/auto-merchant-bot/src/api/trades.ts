import type { ApiClient } from "./client.js"

export type TradeStatus = "INACTIVE" | "ACTIVE" | "LOCKED" | "COMPLETED"
export type ChainKind = "EVM" | "STELLAR"
export type TokenKind = "ERC20" | "NATIVE" | "SAC" | "SEP41"

export interface TradeTokenSummary {
  id: string
  symbol: string
  address: string
  kind: TokenKind
  decimals: number
  chain: {
    name: string
    chainId: string
    kind: ChainKind
  }
}

export interface Trade {
  id: string
  adId: string
  routeId: string
  status: TradeStatus
  adCreatorAddress: string
  bridgerAddress: string
  amount: string
  route: {
    id: string
    adToken: TradeTokenSummary
    orderToken: TradeTokenSummary
  }
  createdAt: string
  updatedAt: string
}

export interface TradesListResponse {
  data: Trade[]
  nextCursor: string | null
}

export interface AdManagerOrderParams {
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
  orderDecimals: number
  adDecimals: number
}

export interface LockResponse {
  chainId: string
  contractAddress: `0x${string}`
  signature: `0x${string}`
  signerPublicKey?: `0x${string}`
  authToken: `0x${string}`
  timeToExpire: number
  orderParams: AdManagerOrderParams
  orderHash: `0x${string}`
  reqHash: `0x${string}`
  chainKind: ChainKind
}

export async function listTrades(
  api: ApiClient,
  params: {
    adCreatorAddress?: string | string[]
    status?: TradeStatus | TradeStatus[]
    limit?: number
    cursor?: string
  },
): Promise<TradesListResponse> {
  return api.get<TradesListResponse>("v1/trades/all", {
    adCreatorAddress: params.adCreatorAddress,
    status: params.status,
    limit: params.limit ?? 50,
    cursor: params.cursor,
  })
}

export async function lockTrade(
  api: ApiClient,
  tradeId: string,
): Promise<LockResponse> {
  return api.post<LockResponse>(`v1/trades/${tradeId}/lock`)
}

export async function confirmTrade(
  api: ApiClient,
  tradeId: string,
  body: { txHash: string; signature?: string },
): Promise<{ tradeId: string; success: boolean }> {
  return api.post(`v1/trades/${tradeId}/confirm`, body)
}
