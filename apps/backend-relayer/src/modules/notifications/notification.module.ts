import { Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PrismaService } from '@prisma/prisma.service';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationService } from './notification.service';

@Module({
  imports: [JwtModule.register({})],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationGateway,
    PrismaService,
    UserJwtGuard,
    JwtService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
