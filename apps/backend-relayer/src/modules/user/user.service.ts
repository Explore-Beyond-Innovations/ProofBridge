import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { ChainKind } from '@prisma/client';
import type { Request } from 'express';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getUser(req: Request) {
    const reqUser = req.user;

    if (!reqUser) throw new UnauthorizedException('Not authenticated');

    const user = await this.prisma.user.findUnique({
      where: { id: reqUser.sub },
      include: {
        wallets: {
          select: { address: true, chainKind: true, createdAt: true },
        },
      },
    });

    if (!user) throw new UnauthorizedException('Unauthorized');

    return user;
  }

  /**
   * Resolve the caller's wallet address on the given chain kind. Throws
   * 403 if the user has no wallet linked for that chain — the frontend
   * should prompt them to connect + link the missing wallet via
   * `/auth/link`.
   */
  async getWalletForChain(
    userId: string,
    chainKind: ChainKind,
  ): Promise<string> {
    const wallet = await this.prisma.userWallet.findUnique({
      where: { userId_chainKind: { userId, chainKind } },
      select: { address: true },
    });
    if (!wallet) {
      throw new ForbiddenException(
        `No ${chainKind} wallet linked — connect and link the matching wallet to continue`,
      );
    }
    return wallet.address;
  }

  /**
   * All canonical addresses linked to the user, regardless of chain kind.
   * Useful for "is this caller any party to this trade" checks where the
   * relevant chain depends on the trade participant.
   */
  async getLinkedAddresses(userId: string): Promise<Set<string>> {
    const wallets = await this.prisma.userWallet.findMany({
      where: { userId },
      select: { address: true },
    });
    return new Set(wallets.map((w) => w.address));
  }
}
