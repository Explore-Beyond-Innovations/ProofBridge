import { Test, TestingModule } from '@nestjs/testing';
import { ChainController } from './chain.controller';
import { ChainService } from './chain.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@prisma/prisma.service';

describe('ChainController (unit)', () => {
  let controller: ChainController;
  let service: jest.Mocked<ChainService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChainController],
      providers: [
        JwtService,
        {
          provide: ChainService,
          useValue: {
            listChainsPublic: jest.fn(),
            getByChainId: jest.fn(),
          },
        },
        PrismaService,
      ],
    }).compile();
    controller = module.get(ChainController);
    service = module.get(ChainService);
  });

  afterEach(() => jest.resetAllMocks());

  it('list -> delegates to service', async () => {
    const mock = { data: [], nextCursor: null };
    const spy = jest
      .spyOn(service, 'listChainsPublic')
      .mockResolvedValueOnce(mock);
    const res = await controller.listChains({ limit: 10 } as any);
    expect(spy).toHaveBeenCalledWith({ limit: 10 });
    expect(res).toBe(mock);
  });

  it('get -> delegates to service', async () => {
    const mockChain = {
      name: 'Base',
      chainId: '8453',
      kind: 'EVM' as const,
      adManagerAddress: '0xAM',
      orderPortalAddress: '0xOP',
      createdAt: new Date().toString(),
      updatedAt: new Date().toString(),
    };
    const spy = jest
      .spyOn(service, 'getByChainId')
      .mockResolvedValueOnce(mockChain);
    const res = await controller.getChain('uuid');
    expect(spy).toHaveBeenCalledWith('uuid');
    expect(res).toEqual(mockChain);
  });
});
