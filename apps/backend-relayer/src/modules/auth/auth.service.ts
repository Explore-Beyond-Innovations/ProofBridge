import {
  BadRequestException,
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

/**
 * Thin router over chain-specific auth services. Owns JWT minting and the
 * shared refresh flow; delegates challenge construction and login signature
 * verification to `EvmAuthService` or `StellarAuthService` based on
 * `chainKind`.
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

  async login(input: {
    chainKind: ChainKind;
    message?: string;
    signature?: string;
    transaction?: string;
  }) {
    const user = await this.verifyLogin(input);
    return this.issueTokens(user);
  }

  private async verifyLogin(input: {
    chainKind: ChainKind;
    message?: string;
    signature?: string;
    transaction?: string;
  }) {
    switch (input.chainKind) {
      case ChainKind.EVM: {
        if (!input.message || !input.signature) {
          throw new BadRequestException(
            'message and signature required for EVM',
          );
        }
        return this.evmAuth.verifyLogin(input.message, input.signature);
      }
      case ChainKind.STELLAR: {
        if (!input.transaction) {
          throw new BadRequestException('transaction required for STELLAR');
        }
        return this.stellarAuth.verifyLogin(input.transaction);
      }
      default:
        throw new BadRequestException('Unsupported chainKind');
    }
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; addr: string; typ?: string };
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
      select: { id: true, walletAddress: true },
    });
    if (!user || user.walletAddress !== payload.addr) {
      throw new UnauthorizedException('User not found or mismatched address');
    }

    return { tokens: await this.mintTokenPair(user) };
  }

  private async issueTokens(user: {
    id: string;
    username: string;
    walletAddress: string;
  }) {
    return {
      user: { id: user.id, username: user.username },
      tokens: await this.mintTokenPair(user),
    };
  }

  private async mintTokenPair(user: { id: string; walletAddress: string }) {
    const [access, refresh] = await Promise.all([
      this.jwt.signAsync(
        { sub: user.id, addr: user.walletAddress, typ: 'access' },
        { secret: env.jwt.secret, expiresIn: '24h', jwtid: randomUUID() },
      ),
      this.jwt.signAsync(
        { sub: user.id, addr: user.walletAddress, typ: 'refresh' },
        { secret: env.jwt.secret, expiresIn: '90d', jwtid: randomUUID() },
      ),
    ]);
    return { access, refresh };
  }
}
