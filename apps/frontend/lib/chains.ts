import { Chain, hederaTestnet, sepolia } from "viem/chains"

export const chains: Record<string, Chain> = {
  [hederaTestnet.id]: hederaTestnet,
  [sepolia.id]: sepolia,
}

// Stellar is non-EVM so it has no viem `Chain`. Backend seeds this id.
export const STELLAR_TESTNET_CHAIN_ID = "1000001"

// Chains currently surfaced in UI selectors. Other chains (Hedera, etc.) remain
// configured on the backend and in wagmi but are hidden from user-facing lists
// while this demo focuses on the Ethereum ↔ Stellar route.
export const VISIBLE_CHAIN_IDS: ReadonlySet<string> = new Set([
  String(sepolia.id),
  STELLAR_TESTNET_CHAIN_ID,
])

export const isVisibleChain = (chainId: string | number): boolean =>
  VISIBLE_CHAIN_IDS.has(String(chainId))
