import { Address } from "viem"

export type ChainKind = "EVM" | "STELLAR"

interface BaseChain {
  name: string
  chainId: string
  createdAt: string
  updatedAt: string
}

export interface IEvmChain extends BaseChain {
  kind: "EVM"
  adManagerAddress: Address
  orderPortalAddress: Address
}

// Stellar contract ids arrive from the backend as 0x + 64 hex (the 32-byte
// form). The viem `Address` type is 20-byte EVM-only, so we model Stellar
// separately and let call sites narrow by `kind`.
export interface IStellarChain extends BaseChain {
  kind: "STELLAR"
  adManagerAddress: `0x${string}`
  orderPortalAddress: `0x${string}`
}

export type IChain = IEvmChain | IStellarChain
