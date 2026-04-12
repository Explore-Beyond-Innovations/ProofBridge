import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PrismaService } from '@prisma/prisma.service';
import { FaucetController } from './faucet.controller';
import { FaucetService } from './faucet.service';
import { ChainProvidersModule } from '../../providers/chain/chain.module';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';

@Module({
  imports: [JwtModule.register({}), ChainProvidersModule],
  controllers: [FaucetController],
  providers: [FaucetService, PrismaService, UserJwtGuard, JwtService],
})
export class FaucetModule {}
