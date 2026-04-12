import { Module } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TradesService } from './trade.service';
import { TradesController } from './trade.controller';
import { ChainProvidersModule } from '../../providers/chain/chain.module';
import { MMRService } from '../mmr/mmr.service';
import { ProofModule } from '../../providers/noir/proof.module';
import { EncryptionService } from '@libs/encryption.service';

@Module({
  imports: [JwtModule.register({}), ChainProvidersModule, ProofModule],
  controllers: [TradesController],
  providers: [
    TradesService,
    PrismaService,
    MMRService,
    EncryptionService,
    JwtService,
  ],
})
export class TradesModule {}
