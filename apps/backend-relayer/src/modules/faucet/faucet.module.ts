import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PrismaService } from '@prisma/prisma.service';
import { FaucetController } from './faucet.controller';
import { FaucetService } from './faucet.service';
import { ChainAdapterModule } from '../../chain-adapters/chain-adapter.module';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';
import { UserModule } from '../user/user.module';

@Module({
  imports: [JwtModule.register({}), ChainAdapterModule, UserModule],
  controllers: [FaucetController],
  providers: [FaucetService, PrismaService, UserJwtGuard, JwtService],
})
export class FaucetModule {}
