import { Injectable } from '@nestjs/common';
import { ChainKind } from '@prisma/client';
import { ChainProvider } from './chain-provider.abstract';
import { EvmChainProvider } from './evm-chain-provider';

// Routes to the concrete ChainProvider implementation for a given chain kind.
// ad/trade/faucet services inject this and do
// `providers.forChain(chain.kind).X(...)` — adding a new chain family is just
// a new ChainProvider subclass wired into this switch.
@Injectable()
export class ChainProviderService {
  constructor(private readonly evm: EvmChainProvider) {}

  forChain(kind: ChainKind): ChainProvider {
    switch (kind) {
      case ChainKind.EVM:
        return this.evm;
      case ChainKind.STELLAR:
        throw new Error('StellarChainProvider not yet implemented');
      default: {
        throw new Error(`Unsupported chain kind: ${String(kind)}`);
      }
    }
  }
}
