import { Address } from "viem"

export type ChainKind = "EVM" | "STELLAR"

export interface IChain {
  name: string
  chainId: string
  kind: ChainKind
  adManagerAddress: Address
  orderPortalAddress: Address
  createdAt: string
  updatedAt: string
}
