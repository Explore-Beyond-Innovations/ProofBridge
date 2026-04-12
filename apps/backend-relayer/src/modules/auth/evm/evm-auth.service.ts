import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { ChainKind } from '@prisma/client';
import { SiweMessage } from 'siwe';
import { ethers } from 'ethers';
import { env } from '@libs/configs';
import { generateUniqueName } from '../username.util';

const CLOCK_SKEW_MS = 60_000;

@Injectable()
export class EvmAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async buildChallenge(address: string): Promise<{
    chainKind: ChainKind;
    nonce: string;
    address: string;
    expiresAt: string;
    domain: string;
    uri: string;
  }> {
    if (!ethers.isAddress(address)) {
      throw new BadRequestException('Invalid EVM format');
    }

    try {
      const value = crypto.randomUUID().replace(/-/g, '');
      const expiresAt = new Date(Date.now() + 5 * 60_000);
      await this.prisma.authNonce.create({
        data: { value, expiresAt, walletAddress: address },
      });
      return {
        chainKind: ChainKind.EVM,
        nonce: value,
        address,
        expiresAt: expiresAt.toISOString(),
        domain: env.appDomain,
        uri: env.appUri,
      };
    } catch (error) {
      console.error('Failed to create auth nonce', error);
      throw new BadRequestException('Failed to create authentication nonce');
    }
  }

  /**
   * Verify a SIWE login. Returns the resolved user row; the caller is
   * responsible for minting JWTs.
   */
  async verifyLogin(
    messageRaw: string,
    signature: string,
  ): Promise<{ id: string; username: string; walletAddress: string }> {
    const msg = this.parseSiwe(messageRaw);
    this.assertDomainAndUri(msg);
    this.assertTimeWindows(msg, Date.now());
    await this.verifySignature(msg, signature);
    return this.consumeNonceAndUpsertUser(msg.address, msg.nonce);
  }

  private parseSiwe(messageRaw: string): SiweMessage {
    try {
      return new SiweMessage(messageRaw);
    } catch {
      throw new BadRequestException('Invalid SIWE message');
    }
  }

  private assertDomainAndUri(msg: SiweMessage): void {
    if (msg.domain !== env.appDomain)
      throw new BadRequestException('Wrong domain');
    if (msg.uri !== env.appUri) throw new BadRequestException('Wrong URI');
  }

  private assertTimeWindows(msg: SiweMessage, nowMs: number): void {
    if (msg.expirationTime) {
      const exp = new Date(msg.expirationTime).getTime();
      if (Number.isNaN(exp) || exp < nowMs - CLOCK_SKEW_MS) {
        throw new BadRequestException('Expired message');
      }
    }
    if (msg.notBefore) {
      const nbf = new Date(msg.notBefore).getTime();
      if (Number.isNaN(nbf) || nbf > nowMs + CLOCK_SKEW_MS) {
        throw new BadRequestException('Not yet valid');
      }
    }
  }

  private async verifySignature(
    msg: SiweMessage,
    signature: string,
  ): Promise<void> {
    try {
      const res = await msg.verify({
        signature,
        domain: env.appDomain,
        nonce: msg.nonce,
      });
      if (!res.success) throw new UnauthorizedException('Verification failed');
    } catch (e) {
      if (!(e instanceof UnauthorizedException)) {
        throw new UnauthorizedException('Bad signature');
      }
      throw e;
    }
  }

  private async consumeNonceAndUpsertUser(address: string, nonce: string) {
    const now = Date.now();

    const { user } = await this.prisma.$transaction(async (tx) => {
      const nonceRow = await tx.authNonce.findUnique({
        where: { value: nonce, walletAddress: address },
      });

      if (!nonceRow) throw new BadRequestException('Unknown nonce');
      if (nonceRow.usedAt) throw new BadRequestException('Nonce already used');
      if (nonceRow.expiresAt.getTime() < now - CLOCK_SKEW_MS) {
        throw new BadRequestException('Nonce expired');
      }

      await tx.authNonce.update({
        where: { value: nonce, walletAddress: address },
        data: { usedAt: new Date() },
      });

      const user = await tx.user.upsert({
        where: { walletAddress: address },
        create: { walletAddress: address, username: generateUniqueName() },
        update: {},
        select: { id: true, username: true, walletAddress: true },
      });

      return { user };
    });

    return user;
  }
}
