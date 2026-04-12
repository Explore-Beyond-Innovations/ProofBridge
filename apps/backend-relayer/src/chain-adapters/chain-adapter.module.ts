import { Module } from '@nestjs/common';
import { ViemModule } from '../providers/viem/viem.module';
import { StellarModule } from '../providers/stellar/stellar.module';
import { EvmChainAdapter } from './adapters/evm-chain-adapter';
import { StellarChainAdapter } from './adapters/stellar-chain-adapter';
import { ChainAdapterService } from './chain-adapter.service';

@Module({
  imports: [ViemModule, StellarModule],
  providers: [EvmChainAdapter, StellarChainAdapter, ChainAdapterService],
  exports: [ChainAdapterService],
})
export class ChainAdapterModule {}
