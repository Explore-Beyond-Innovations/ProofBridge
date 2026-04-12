import { Chain, defineChain } from 'viem';

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
      http: ['http://localhost:9545'],
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
      http: ['http://localhost:7546'],
    },
  },
});
