"use client"
import { useEvmAdapter } from "./useEvmAdapter"
import { useStellarAdapter } from "./useStellarAdapter"
import type { ChainAdapter } from "./types"

// Register new chains here. Each hook returns the ChainAdapter shape defined
// in ./types.ts — no other wiring is needed for the hub UI to pick it up.
export const useAdapters = (): ChainAdapter[] => {
  const evm = useEvmAdapter()
  const stellar = useStellarAdapter()
  return [evm, stellar]
}
