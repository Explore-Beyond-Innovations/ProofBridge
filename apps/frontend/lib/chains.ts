import { Chain, foundry, hederaTestnet, sepolia } from "viem/chains"

export const chains: Record<string, Chain> = {
  [sepolia.id]: sepolia,
  [foundry.id]: foundry,
  [hederaTestnet.id]: hederaTestnet,
}

// Stellar is non-EVM so it has no viem `Chain`. Backend seeds this id.
export const STELLAR_TESTNET_CHAIN_ID = "1000001"
export const SEPOLIA_CHAIN_ID = String(sepolia.id)

const localChainsEnabled =
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_CHAINS === "true"

// Chains currently surfaced in UI selectors. Other chains (Hedera, etc.) remain
// configured in wagmi but are hidden from user-facing lists while this demo
// focuses on the Ethereum ↔ Stellar route. Set NEXT_PUBLIC_ENABLE_LOCAL_CHAINS
// to expose the local docker stack (anvil 31337) alongside the testnet chains.
export const VISIBLE_CHAIN_IDS: ReadonlySet<string> = new Set([
  String(sepolia.id),
  STELLAR_TESTNET_CHAIN_ID,
  ...(localChainsEnabled ? [String(foundry.id)] : []),
])

export const isVisibleChain = (chainId: string | number): boolean =>
  VISIBLE_CHAIN_IDS.has(String(chainId))

// Human-readable chain name for a given chainId. Falls back to `Chain {id}`
// so missing configs stay visible in the UI instead of rendering blank.
export const getChainName = (chainId: string | number | undefined): string => {
  if (chainId == null) return ""
  const id = String(chainId)
  if (id === STELLAR_TESTNET_CHAIN_ID) return "Stellar"
  return chains[id]?.name ?? `Chain ${id}`
}
