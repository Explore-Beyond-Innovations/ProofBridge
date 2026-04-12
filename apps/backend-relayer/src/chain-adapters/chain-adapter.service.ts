import { Injectable } from '@nestjs/common';
import { ChainKind } from '@prisma/client';
import { ChainAdapter } from './adapters/chain-adapter.abstract';
import { EvmChainAdapter } from './adapters/evm-chain-adapter';
import { StellarChainAdapter } from './adapters/stellar-chain-adapter';

@Injectable()
export class ChainAdapterService {
  constructor(
    private readonly evm: EvmChainAdapter,
    private readonly stellar: StellarChainAdapter,
  ) {}

  forChain(kind: ChainKind): ChainAdapter {
    switch (kind) {
      case ChainKind.EVM:
        return this.evm;
      case ChainKind.STELLAR:
        return this.stellar;
      default: {
        throw new Error(`Unsupported chain kind: ${String(kind)}`);
      }
    }
  }
}
