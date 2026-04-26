/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { JwtService } from '@nestjs/jwt';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { env } from '@libs/configs';
import { Request } from 'express';

@Injectable()
export class AdminJwtGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const token =
      req.headers['authorization']?.split('Bearer ')[1] ?? undefined;

    if (!token) throw new UnauthorizedException('Missing bearer token');

    let decoded: { sub: string } & Record<string, unknown>;
    try {
      decoded = await this.jwtService.verifyAsync(token, {
        secret: env.jwt.secret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: decoded.sub },
    });
    if (!admin) throw new UnauthorizedException('Admin no longer exists');

    req.admin = decoded;
    return true;
  }
}
