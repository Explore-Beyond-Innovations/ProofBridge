import { Address } from "viem"
import { TradeStatusT } from "./ads"
import type { ChainKind } from "./chains"
import { IToken } from "./tokens"

export interface ICreateTradeRequest {
  adId: string
  routeId: string
  amount: string
  // Cross-chain: 0x… on EVM, G-strkey on Stellar. Backend normalizes.
  bridgerDstAddress: string
}

export interface ICreateTradeResponse {
  tradeId: string
  reqContractDetails: {
    chainId: string
    contractAddress: Address
    signature: Address
    signerPublicKey?: Address
    authToken: Address
    timeToExpire: number
    // Create-trade always targets the OrderPortal (order chain side).
    orderParams: IOrderPortalOrderParams
    orderHash: string
    reqHash: string
    chainKind: ChainKind
  }
}

export interface IAdManagerOrderParams {
  orderChainToken: Address
  adChainToken: Address
  amount: string
  bridger: Address
  orderChainId: string
  srcOrderPortal: Address
  orderRecipient: Address
  adId: string
  adCreator: Address
  adRecipient: Address
  salt: string
}

export interface IOrderPortalOrderParams {
  orderChainToken: Address
  adChainToken: Address
  amount: string
  bridger: Address
  adChainId: string
  adManager: Address
  orderRecipient: Address
  adId: string
  adCreator: Address
  adRecipient: Address
  salt: string
}

export interface ILockFundsReponse {
  chainId: string
  contractAddress: Address
  signature: Address
  signerPublicKey?: Address
  authToken: Address
  timeToExpire: number
  orderParams: IAdManagerOrderParams
  orderHash: Address
  reqHash: Address
  chainKind: ChainKind
}

export interface IUnlockFundsResponse {
  chainId: string
  contractAddress: Address
  signature: Address
  signerPublicKey?: Address
  authToken: Address
  timeToExpire: number
  // Discriminate on the presence of `adManager` (OrderPortal side, adCreator
  // unlocking) vs `srcOrderPortal` (AdManager side, bridger unlocking).
  orderParams: IOrderPortalOrderParams | IAdManagerOrderParams
  nullifierHash: Address
  targetRoot: Address
  proof: Address
  orderHash: Address
  reqHash: Address
  chainKind: ChainKind
}

export interface IUnlockFundsRequest {
  id: string
  // `0x`-hex on EVM, base64 SEP-43 on Stellar — backend normalizes.
  signature: string
}

export interface IConfirmUnlockFundsRequest {
  id: string
  signature: string
  txHash: string
}

export interface IConfirmTradeTxRequest {
  tradeId: string
  txHash: string
  signature: string
}

export interface IConfirmTradeTxReponse {
  tradeId: string
  success: true
}

export interface IGetTradesParams {
  adCreatorAddress?: Address
  bridgerAddress?: Address
  routeId?: string
  cursor?: string
  limit?: number
  adId?: string
  minAmount?: string
  maxAmount?: string
  orderTokenId?: string
  adTokenId?: string
}

export interface ITrade {
  id: string
  routeId: string
  adId: string
  adCreatorAddress: Address
  bridgerAddress: Address
  amount: string
  status: TradeStatusT
  createdAt: string
  updatedAt: string
  ad: {
    id: string
    routeId: string
    creatorAddress: Address
  }
  route: {
    id: string
    adToken: IToken
    orderToken: IToken
  }
  adCreatorClaimed: boolean
  bridgerClaimed: boolean
}

export interface ITradeParams {
  orderChainToken: Address
  adChainToken: Address
  amount: string
  bridger: Address
  orderRecipient: Address
  adId: string
  adCreator: Address
  adRecipient: Address
  salt: string
  orderChainId: string
  orderPortal: Address
  adChainId: string
  adManager: Address
  orderHash: string
  // Chain kind of the chain this caller unlocks on. Drives signing flow —
  // EVM → EIP-712; STELLAR → SEP-43 signMessage.
  unlockChainKind: ChainKind
}
