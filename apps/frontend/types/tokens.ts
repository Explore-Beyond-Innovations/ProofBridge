import { Address } from "viem"
import type { ChainKind } from "./chains"

export type TokenKind = "NATIVE" | "ERC20" | "SAC" | "SEP41"

export interface IGetTokensParams {
  limit?: string
  cursor?: string
  chainId?: string
  address?: string
}

export interface IToken {
  id: string
  symbol: string
  name: string
  address: Address
  decimals: number
  kind: TokenKind
  /** Stellar classic-asset issuer (G-strkey). Populated only for SAC tokens. */
  assetIssuer?: string | null
  createdAt: string
  updatedAt: string
  chain: {
    id: string
    name: string
    chainId: string
    kind: ChainKind
  }
}
