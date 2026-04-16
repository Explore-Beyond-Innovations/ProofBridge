import { Module } from '@nestjs/common';
import { AdsController } from './ad.controller';
import { AdsService } from './ad.service';
import { PrismaService } from '@prisma/prisma.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ChainAdapterModule } from '../../chain-adapters/chain-adapter.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [JwtModule.register({}), ChainAdapterModule, UserModule],
  controllers: [AdsController],
  providers: [AdsService, PrismaService, JwtService],
})
export class AdsModule {}
