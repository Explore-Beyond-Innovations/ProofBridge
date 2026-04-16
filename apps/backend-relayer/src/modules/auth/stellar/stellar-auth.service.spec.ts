import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Keypair, TransactionBuilder, Networks } from '@stellar/stellar-sdk';

// The service reads env.stellar.authSecret at construction time; set it before
// the module is evaluated so the Keypair.fromSecret path succeeds.
const SERVER_SECRET =
  'SA3C2KPR5TCHYJ5TNQXAY2776Z3H4CB723GDCAMEX5I2NLWP25QUYB3X';
process.env.STELLAR_AUTH_SECRET = SERVER_SECRET;
process.env.SIGN_DOMAIN = 'proofbridge.xyz';
process.env.SIGN_URI = 'https://proofbridge.xyz';

import { StellarAuthService } from './stellar-auth.service';
import { accountIdToHex32 } from '../../../providers/stellar/utils/address';
import type { PrismaService } from '@prisma/prisma.service';

describe('StellarAuthService (SEP-10)', () => {
  const mockPrisma = {
    authNonce: { create: jest.fn() },
  };

  let service: StellarAuthService;
  let client: Keypair;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StellarAuthService(mockPrisma as unknown as PrismaService);
    client = Keypair.random();
  });

  describe('buildChallenge', () => {
    it('returns a SEP-10 challenge for a valid G-strkey', () => {
      const res = service.buildChallenge(client.publicKey());

      expect(res.chainKind).toBe('STELLAR');
      expect(res.address).toBe(client.publicKey());
      expect(res.transaction).toEqual(expect.any(String));
      expect(res.networkPassphrase).toBeTruthy();
      expect(new Date(res.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('rejects non-Ed25519 inputs', () => {
      expect(() => service.buildChallenge('not-a-strkey')).toThrow(
        BadRequestException,
      );
      expect(() =>
        service.buildChallenge('0x1234567890abcdef1234567890abcdef12345678'),
      ).toThrow(BadRequestException);
    });
  });

  describe('verifyAndConsume', () => {
    const sign = (xdr: string, kp: Keypair) => {
      // Match the service's fallback: configs.ts uses `||` so an empty env
      // var falls back to TESTNET. `??` would keep `""` and mismatch.
      const passphrase =
        (process.env.STELLAR_NETWORK_PASSPHRASE as Networks) ||
        Networks.TESTNET;
      const tx = TransactionBuilder.fromXDR(xdr, passphrase);
      tx.sign(kp);
      return tx.toEnvelope().toXDR('base64');
    };

    it('returns the canonical hex32 address when the client co-signs', async () => {
      mockPrisma.authNonce.create.mockResolvedValueOnce({});

      const { transaction } = service.buildChallenge(client.publicKey());
      const signedXdr = sign(transaction, client);

      const address = await service.verifyAndConsume(signedXdr);

      expect(address).toBe(accountIdToHex32(client.publicKey()));
      expect(mockPrisma.authNonce.create).toHaveBeenCalledTimes(1);
    });

    it('rejects when the client signature is missing', async () => {
      const { transaction } = service.buildChallenge(client.publicKey());

      await expect(service.verifyAndConsume(transaction)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockPrisma.authNonce.create).not.toHaveBeenCalled();
    });

    it('rejects when a different keypair signs the challenge', async () => {
      const imposter = Keypair.random();
      const { transaction } = service.buildChallenge(client.publicKey());
      const signedByImposter = sign(transaction, imposter);

      await expect(service.verifyAndConsume(signedByImposter)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects replay (second verify with the same XDR)', async () => {
      mockPrisma.authNonce.create
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('unique violation'));

      const { transaction } = service.buildChallenge(client.publicKey());
      const signedXdr = sign(transaction, client);

      await service.verifyAndConsume(signedXdr);
      await expect(service.verifyAndConsume(signedXdr)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects malformed XDR', async () => {
      await expect(service.verifyAndConsume('not-valid-xdr')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
