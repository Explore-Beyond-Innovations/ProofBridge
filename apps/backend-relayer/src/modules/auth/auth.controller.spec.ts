import { Test, TestingModule } from '@nestjs/testing';
import { ChainKind } from '@prisma/client';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserJwtGuard } from '../../common/guards/user-jwt.guard';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            challenge: jest.fn(),
            login: jest.fn(),
            refresh: jest.fn(),
            linkWallet: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(UserJwtGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('POST /v1/auth/challenge', () => {
    it('routes EVM challenge and returns payload', async () => {
      const address = '0x1234567890abcdef1234567890abcdef12345678';
      const mockPayload = {
        chainKind: ChainKind.EVM,
        nonce: 'abc123',
        address,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        domain: 'proofbridge.xyz',
        uri: 'https://proofbridge.xyz',
      };

      const spy = jest
        .spyOn(service, 'challenge')
        .mockResolvedValueOnce(mockPayload);

      const res = await controller.challenge({
        address,
        chainKind: ChainKind.EVM,
      });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(address, ChainKind.EVM);
      expect(res).toEqual(mockPayload);
    });

    it('routes Stellar challenge and returns SEP-10 payload', async () => {
      const address =
        'GABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXY234567ABCDE';
      const mockPayload = {
        chainKind: ChainKind.STELLAR,
        address,
        expiresAt: new Date(Date.now() + 300_000).toISOString(),
        transaction: 'base64-xdr...',
        networkPassphrase: 'Test SDF Network ; September 2015',
      };

      const spy = jest
        .spyOn(service, 'challenge')
        .mockResolvedValueOnce(mockPayload);

      const res = await controller.challenge({
        address,
        chainKind: ChainKind.STELLAR,
      });

      expect(spy).toHaveBeenCalledWith(address, ChainKind.STELLAR);
      expect(res).toEqual(mockPayload);
    });

    it('propagates service errors', async () => {
      const address = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

      jest.spyOn(service, 'challenge').mockRejectedValueOnce(new Error('boom'));

      await expect(
        controller.challenge({ address, chainKind: ChainKind.EVM }),
      ).rejects.toThrow('boom');
    });
  });

  describe('POST /v1/auth/refresh', () => {
    it('calls AuthService.refresh and returns new tokens', async () => {
      const dto = { refresh: 'valid-refresh-token' };
      const mockResult = {
        tokens: { access: 'new-jwt-access', refresh: 'new-jwt-refresh' },
      };

      const spy = jest
        .spyOn(service, 'refresh')
        .mockResolvedValueOnce(mockResult);

      const res = await controller.refresh(dto);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(dto.refresh);
      expect(res).toEqual(mockResult);
    });

    it('propagates invalid refresh token error', async () => {
      const dto = { refresh: 'invalid-token' };

      jest
        .spyOn(service, 'refresh')
        .mockRejectedValueOnce(new Error('Invalid refresh token'));

      await expect(controller.refresh(dto)).rejects.toThrow(
        'Invalid refresh token',
      );
    });
  });

  describe('POST /v1/auth/login', () => {
    it('forwards EVM login DTO to AuthService.login', async () => {
      const dto = {
        chainKind: ChainKind.EVM,
        message:
          'service.xyz wants you to sign in with your Ethereum account:\n...',
        signature: '0xsignature',
      };
      const mockResult = {
        user: { id: 'u1', username: 'dummy_abcd' },
        tokens: { access: 'jwt-access', refresh: 'jwt-refresh' },
      };

      const spy = jest
        .spyOn(service, 'login')
        .mockResolvedValueOnce(mockResult);

      const res = await controller.login(dto);

      expect(spy).toHaveBeenCalledWith(dto);
      expect(res).toEqual(mockResult);
    });

    it('forwards Stellar login DTO (transaction only) to AuthService.login', async () => {
      const dto = {
        chainKind: ChainKind.STELLAR,
        transaction: 'co-signed-xdr-base64',
      };
      const mockResult = {
        user: { id: 'u2', username: 'stellar_user' },
        tokens: { access: 'jwt-access', refresh: 'jwt-refresh' },
      };

      const spy = jest
        .spyOn(service, 'login')
        .mockResolvedValueOnce(mockResult);

      const res = await controller.login(dto);

      expect(spy).toHaveBeenCalledWith(dto);
      expect(res).toEqual(mockResult);
    });

    it('propagates service errors (e.g., invalid signature)', async () => {
      const dto = {
        chainKind: ChainKind.EVM,
        message: 'bad',
        signature: '0x00',
      };

      jest
        .spyOn(service, 'login')
        .mockRejectedValueOnce(new Error('Unauthorized'));

      await expect(controller.login(dto)).rejects.toThrow('Unauthorized');
    });
  });
});
