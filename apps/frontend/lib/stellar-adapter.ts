"use client"
import { useStellarWallet } from "@/components/providers/StellarWallet"
import type { StellarAdapterCtx } from "@/utils/stellar/actions"
import type { TrustlineCtx } from "@/utils/stellar/trustline"

const DEFAULT_TESTNET_RPC = "https://soroban-testnet.stellar.org"
const DEFAULT_TESTNET_HORIZON = "https://horizon-testnet.stellar.org"

export function useStellarAdapter(): {
  buildCtx: () => StellarAdapterCtx
  buildTrustlineCtx: () => TrustlineCtx
  address: string | null
} {
  const { address, networkPassphrase, signTransaction } = useStellarWallet()

  const buildCtx = (): StellarAdapterCtx => {
    if (!address) {
      throw new Error("Stellar wallet not connected")
    }
    const rpcUrl =
      process.env.NEXT_PUBLIC_STELLAR_RPC_URL || DEFAULT_TESTNET_RPC
    return {
      rpcUrl,
      networkPassphrase,
      signerPublicKey: address,
      signTransaction,
    }
  }

  const buildTrustlineCtx = (): TrustlineCtx => {
    if (!address) {
      throw new Error("Stellar wallet not connected")
    }
    const horizonUrl =
      process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || DEFAULT_TESTNET_HORIZON
    return {
      horizonUrl,
      networkPassphrase,
      signerPublicKey: address,
      signTransaction,
    }
  }

  return { buildCtx, buildTrustlineCtx, address }
}
