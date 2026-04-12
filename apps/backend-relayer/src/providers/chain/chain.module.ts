import { Module } from '@nestjs/common';
import { ViemModule } from '../viem/viem.module';
import { EvmChainProvider } from './evm-chain-provider';
import { ChainProviderService } from './chain-provider.service';

@Module({
  imports: [ViemModule],
  providers: [EvmChainProvider, ChainProviderService],
  exports: [ChainProviderService],
})
export class ChainProvidersModule {}
