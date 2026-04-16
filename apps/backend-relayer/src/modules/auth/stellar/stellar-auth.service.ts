import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Keypair,
  Networks,
  StrKey,
  TransactionBuilder,
  WebAuth,
} from '@stellar/stellar-sdk';
import { env } from '@libs/configs';
import { PrismaService } from '@prisma/prisma.service';
import { ChainKind } from '@prisma/client';
import { accountIdToHex32 } from '../../../providers/stellar/utils/address';

const CHALLENGE_TIMEOUT_SECONDS = 300;

@Injectable()
export class StellarAuthService {
  private readonly logger = new Logger(StellarAuthService.name);
  private readonly serverKeypair: Keypair;

  constructor(private readonly prisma: PrismaService) {
    const secret = env.stellar.authSecret;
    if (!secret) {
      throw new Error(
        'STELLAR_AUTH_SECRET not set — required for Stellar SEP-10 auth',
      );
    }
    if (!StrKey.isValidEd25519SecretSeed(secret)) {
      throw new Error('STELLAR_AUTH_SECRET must be an S… Stellar secret seed');
    }
    this.serverKeypair = Keypair.fromSecret(secret);
  }

  /**
   * Build a SEP-10 challenge transaction for the given account. The caller's
   * wallet co-signs it and returns it to /auth/login.
   */
  buildChallenge(accountId: string): {
    chainKind: ChainKind;
    address: string;
    transaction: string;
    networkPassphrase: string;
    expiresAt: string;
  } {
    if (!StrKey.isValidEd25519PublicKey(accountId)) {
      throw new BadRequestException(
        'Invalid Stellar account ID — expected G-strkey',
      );
    }

    const transaction = WebAuth.buildChallengeTx(
      this.serverKeypair,
      accountId,
      env.appDomain,
      CHALLENGE_TIMEOUT_SECONDS,
      env.stellar.networkPassphrase,
      env.appDomain,
    );

    return {
      chainKind: ChainKind.STELLAR,
      address: accountId,
      transaction,
      networkPassphrase: env.stellar.networkPassphrase,
      expiresAt: new Date(
        Date.now() + CHALLENGE_TIMEOUT_SECONDS * 1000,
      ).toISOString(),
    };
  }

  /**
   * Verify a co-signed SEP-10 challenge transaction and record the tx hash
   * to prevent replay. Returns the canonical hex32 wallet address. User /
   * wallet persistence is the caller's responsibility.
   */
  async verifyAndConsume(transactionXdr: string): Promise<string> {
    const { walletAddress } = this.verifyChallenge(transactionXdr);

    // Challenge transactions are self-contained (server-signed + timebound),
    // but nothing in SEP-10 prevents replay within the validity window —
    // record the tx hash and reject duplicates.
    const txHash = this.challengeTxHash(transactionXdr);
    const now = new Date();
    try {
      await this.prisma.authNonce.create({
        data: {
          value: txHash,
          walletAddress,
          expiresAt: new Date(now.getTime() + CHALLENGE_TIMEOUT_SECONDS * 1000),
          usedAt: now,
        },
      });
    } catch {
      throw new UnauthorizedException('Challenge already used');
    }

    return walletAddress;
  }

  /**
   * Verify the SEP-10 transaction structure and signatures. Throws on any
   * failure; returns the client's G-strkey and its 0x+64hex canonical form.
   */
  private verifyChallenge(transactionXdr: string): {
    accountId: string;
    walletAddress: `0x${string}`;
  } {
    let clientAccountID: string;
    try {
      const result = WebAuth.readChallengeTx(
        transactionXdr,
        this.serverKeypair.publicKey(),
        env.stellar.networkPassphrase,
        env.appDomain,
        env.appDomain,
      );
      clientAccountID = result.clientAccountID;
    } catch (err) {
      this.logger.warn(
        `SEP-10 readChallengeTx failed: ${(err as Error).message}`,
      );
      throw new UnauthorizedException('Invalid Stellar challenge transaction');
    }

    try {
      WebAuth.verifyChallengeTxSigners(
        transactionXdr,
        this.serverKeypair.publicKey(),
        env.stellar.networkPassphrase,
        [clientAccountID],
        env.appDomain,
        env.appDomain,
      );
    } catch (err) {
      this.logger.warn(
        `SEP-10 verifyChallengeTxSigners failed: ${(err as Error).message}`,
      );
      throw new UnauthorizedException('Stellar challenge signature invalid');
    }

    return {
      accountId: clientAccountID,
      walletAddress: accountIdToHex32(clientAccountID),
    };
  }

  private challengeTxHash(xdr: string): string {
    const tx = TransactionBuilder.fromXDR(
      xdr,
      env.stellar.networkPassphrase as Networks,
    );
    return tx.hash().toString('hex');
  }
}
