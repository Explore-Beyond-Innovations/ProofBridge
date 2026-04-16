import { Module } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TradesService } from './trade.service';
import { TradesController } from './trade.controller';
import { ChainAdapterModule } from '../../chain-adapters/chain-adapter.module';
import { MMRService } from '../mmr/mmr.service';
import { ProofModule } from '../../providers/noir/proof.module';
import { EncryptionService } from '@libs/encryption.service';
import { UserModule } from '../user/user.module';

@Module({
  imports: [JwtModule.register({}), ChainAdapterModule, ProofModule, UserModule],
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
