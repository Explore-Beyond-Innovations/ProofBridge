import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { env } from '@libs/configs';
import { PrismaService } from '@prisma/prisma.service';
import { ChainKind } from '@prisma/client';
import { randomUUID } from 'crypto';
import { EvmAuthService } from './evm/evm-auth.service';
import { StellarAuthService } from './stellar/stellar-auth.service';
import { generateUniqueName } from './username.util';

type LoginInput = {
  chainKind: ChainKind;
  message?: string;
  signature?: string;
  transaction?: string;
};

/**
 * Thin router over chain-specific auth services. Owns JWT minting, user
 * creation, and wallet linking; delegates challenge construction and
 * signature verification to `EvmAuthService` or `StellarAuthService`.
 *
 * A User may hold multiple wallets (one per chain kind). First sign-in
 * creates the user; subsequent sign-ins on other chains go through
 * `/auth/link` and attach another row to `UserWallet`.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly evmAuth: EvmAuthService,
    private readonly stellarAuth: StellarAuthService,
  ) {}

  async challenge(address: string, chainKind: ChainKind) {
    switch (chainKind) {
      case ChainKind.EVM:
        return this.evmAuth.buildChallenge(address);
      case ChainKind.STELLAR:
        return this.stellarAuth.buildChallenge(address);
      default:
        throw new BadRequestException('Unsupported chainKind');
    }
  }

  async login(input: LoginInput) {
    const { address, chainKind } = await this.verifySignature(input);
    const user = await this.resolveOrCreateUser({ address, chainKind });
    return this.issueTokens(user);
  }

  async linkWallet(userId: string, input: LoginInput) {
    const { address, chainKind } = await this.verifySignature(input);
    return this.attachWalletToUser({ userId, address, chainKind });
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; typ?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: env.jwt.secret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('Wrong token type');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, username: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    return { tokens: await this.mintTokenPair(user) };
  }

  private async verifySignature(
    input: LoginInput,
  ): Promise<{ address: string; chainKind: ChainKind }> {
    switch (input.chainKind) {
      case ChainKind.EVM: {
        if (!input.message || !input.signature) {
          throw new BadRequestException(
            'message and signature required for EVM',
          );
        }
        const address = await this.evmAuth.verifyAndConsume(
          input.message,
          input.signature,
        );
        return { address, chainKind: ChainKind.EVM };
      }
      case ChainKind.STELLAR: {
        if (!input.transaction) {
          throw new BadRequestException('transaction required for STELLAR');
        }
        const address = await this.stellarAuth.verifyAndConsume(
          input.transaction,
        );
        return { address, chainKind: ChainKind.STELLAR };
      }
      default:
        throw new BadRequestException('Unsupported chainKind');
    }
  }

  private async resolveOrCreateUser(args: {
    address: string;
    chainKind: ChainKind;
  }): Promise<{ id: string; username: string }> {
    const existing = await this.prisma.userWallet.findUnique({
      where: {
        address_chainKind: {
          address: args.address,
          chainKind: args.chainKind,
        },
      },
      select: { user: { select: { id: true, username: true } } },
    });
    if (existing) return existing.user;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: generateUniqueName(),
          wallets: {
            create: { address: args.address, chainKind: args.chainKind },
          },
        },
        select: { id: true, username: true },
      });
      return user;
    });
  }

  private async attachWalletToUser(args: {
    userId: string;
    address: string;
    chainKind: ChainKind;
  }) {
    const existingForAddress = await this.prisma.userWallet.findUnique({
      where: {
        address_chainKind: {
          address: args.address,
          chainKind: args.chainKind,
        },
      },
      select: { userId: true },
    });
    if (existingForAddress) {
      if (existingForAddress.userId === args.userId) {
        throw new ConflictException('Wallet already linked to this account');
      }
      throw new ConflictException(
        'Wallet is already linked to a different account',
      );
    }

    const existingForUserChain = await this.prisma.userWallet.findUnique({
      where: {
        userId_chainKind: {
          userId: args.userId,
          chainKind: args.chainKind,
        },
      },
      select: { id: true },
    });
    if (existingForUserChain) {
      throw new ConflictException(
        'Account already has a wallet linked on this chain',
      );
    }

    return this.prisma.userWallet.create({
      data: {
        userId: args.userId,
        address: args.address,
        chainKind: args.chainKind,
      },
      select: {
        id: true,
        address: true,
        chainKind: true,
        createdAt: true,
      },
    });
  }

  private async issueTokens(user: { id: string; username: string }) {
    return {
      user: { id: user.id, username: user.username },
      tokens: await this.mintTokenPair(user),
    };
  }

  private async mintTokenPair(user: { id: string }) {
    const [access, refresh] = await Promise.all([
      this.jwt.signAsync(
        { sub: user.id, typ: 'access' },
        { secret: env.jwt.secret, expiresIn: '24h', jwtid: randomUUID() },
      ),
      this.jwt.signAsync(
        { sub: user.id, typ: 'refresh' },
        { secret: env.jwt.secret, expiresIn: '90d', jwtid: randomUUID() },
      ),
    ]);
    return { access, refresh };
  }
}
