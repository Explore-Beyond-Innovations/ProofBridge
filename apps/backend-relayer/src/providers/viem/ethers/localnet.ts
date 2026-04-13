import { Chain, defineChain } from 'viem';

// Defaults target a host-local anvil/hedera. In containerized e2e the host is
// reachable via `host.docker.internal`, so honor env overrides when present.
export const ethLocalnet: Chain = defineChain({
  id: 31337,
  name: 'ETH LOCALNET',
  nativeCurrency: {
    decimals: 18,
    name: 'ETHEREYM',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: [process.env.ETHEREUM_RPC_URL || 'http://localhost:9545'],
    },
  },
});

export const hederaLocalnet: Chain = defineChain({
  id: 298,
  name: 'HEDERA LOCALNET',
  nativeCurrency: {
    decimals: 18,
    name: 'HBAR',
    symbol: 'HBAR',
  },
  rpcUrls: {
    default: {
      http: [process.env.HEDERA_RPC_URL || 'http://localhost:7546'],
    },
  },
});
