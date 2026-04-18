import { createConfig } from "wagmi"
import { foundry, sepolia, type Chain } from "viem/chains"
import { http } from "viem"

const localEnabled =
  process.env.NEXT_PUBLIC_ENABLE_LOCAL_CHAINS === "true"

// Anvil inside the local docker stack is exposed on host port 9545.
const anvilRpc = "http://localhost:9545"

const chainList: readonly [Chain, ...Chain[]] = localEnabled
  ? [foundry, sepolia]
  : [sepolia]

export const config = createConfig({
  chains: chainList,
  transports: {
    [foundry.id]: http(anvilRpc),
    [sepolia.id]: http(),
  },
})
