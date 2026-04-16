import { Module } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { UserService } from './user.service';
import { UserController } from './user.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [UserController],
  providers: [UserService, PrismaService],
  exports: [UserService],
})
export class UserModule {}
