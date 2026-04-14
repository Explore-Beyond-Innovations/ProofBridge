import { Address } from "viem"
import type { ChainKind } from "./chains"

export type TokenKind = "NATIVE" | "ERC20" | "SAC" | "SEP41"

export interface IGetTokensParams {
  limit?: string
  cursor?: string
  chainId?: string
  address?: string
}

interface BaseToken {
  id: string
  symbol: string
  name: string
  decimals: number
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

export interface IEvmToken extends BaseToken {
  kind: "NATIVE" | "ERC20"
  address: Address
}

// Stellar token ids (SAC contract id or SEP-41 contract id) arrive as
// 0x + 64 hex — the 32-byte form. Not a 20-byte EVM address.
export interface IStellarToken extends BaseToken {
  kind: "SAC" | "SEP41"
  address: `0x${string}`
}

export type IToken = IEvmToken | IStellarToken
