import { Module } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { ChainModule } from './modules/chains/chain.module';
import { TokenModule } from './modules/token/token.module';
import { RoutesModule } from './modules/routes/route.module';
import { AdsModule } from './modules/ads/ad.module';
import { TradesModule } from './modules/trades/trade.module';
import { MMRModule } from './modules/mmr/mmr.module';
import { ViemModule } from './providers/viem/viem.module';
import { UserModule } from './modules/user/user.module';
import { FaucetModule } from './modules/faucet/faucet.module';
import { NotificationModule } from './modules/notifications/notification.module';

@Module({
  imports: [
    AuthModule,
    AdminModule,
    ChainModule,
    TokenModule,
    RoutesModule,
    AdsModule,
    TradesModule,
    MMRModule,
    ViemModule,
    UserModule,
    FaucetModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
