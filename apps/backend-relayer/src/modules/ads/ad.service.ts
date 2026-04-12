import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import {
  CreateAdDto,
  FundAdDto,
  QueryAdsDto,
  UpdateAdDto,
  WithdrawalAdDto,
  ConfirmAdActionDto,
  CloseAdDto,
} from './dto/ad.dto';
import { getAddress } from 'viem';
import { AdStatus, Prisma } from '@prisma/client';
import { Request } from 'express';
import { ChainAdapterService } from '../../chain-adapters/chain-adapter.service';
import { toBytes32 } from '../../providers/viem/ethers/typedData';
import { randomUUID } from 'crypto';

type AdQueryInput = {
  routeId?: string;
  creatorAddress?: string;
  status?: AdStatus;
  adChainId?: bigint;
  orderChainId?: bigint;
  adTokenId?: string;
  orderTokenId?: string;
};

type AdUpdateInput = {
  minAmount?: Prisma.Decimal | undefined;
  maxAmount?: Prisma.Decimal | undefined;
  metadata?: any;
  status?: AdStatus;
};

type AdUpdateLogInput = {
  poolAmount?: string;
  status?: AdStatus;
};

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chainAdapters: ChainAdapterService,
  ) {}

  async list(query: QueryAdsDto) {
    try {
      const take =
        query.limit && query.limit > 0 && query.limit <= 100 ? query.limit : 25;
      const cursor = query.cursor ? { id: query.cursor } : undefined;

      const where: AdQueryInput = {};

      if (query.routeId) where.routeId = query.routeId;
      if (query.creatorAddress) where.creatorAddress = query.creatorAddress;
      if (query.status) where.status = query.status;
      if (query.adTokenId) where.adTokenId = query.adTokenId;
      if (query.orderTokenId) where.orderTokenId = query.orderTokenId;

      const items = await this.prisma.ad.findMany({
        where: {
          ...where,
          adToken: {
            chain: query.adChainId ? { chainId: query.adChainId } : undefined,
          },
          orderToken: {
            chain: query.orderChainId
              ? { chainId: query.orderChainId }
              : undefined,
          },
        },
        orderBy: { id: 'asc' },
        take: take + 1,
        ...(cursor ? { cursor, skip: 1 } : {}),
        select: {
          id: true,
          creatorAddress: true,
          routeId: true,
          adTokenId: true,
          orderTokenId: true,
          poolAmount: true,
          minAmount: true,
          maxAmount: true,
          adToken: {
            select: {
              chain: { select: { chainId: true } },
              address: true,
              symbol: true,
              name: true,
              decimals: true,
              kind: true,
            },
          },
          orderToken: {
            select: {
              chain: { select: { chainId: true } },
              address: true,
              symbol: true,
              name: true,
              decimals: true,
              kind: true,
            },
          },
          status: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
          route: true,
        },
      });

      // compute locksums for all returned ads
      const ids = items.map((i) => i.id);
      const lockSums = ids.length
        ? await this.prisma.adLock.groupBy({
            by: ['adId'],
            where: { adId: { in: ids }, releasedAt: null },
            _sum: { amount: true },
          })
        : [];

      const sumMap = new Map<string, Prisma.Decimal>();
      lockSums.forEach((row) =>
        sumMap.set(row.adId, row._sum.amount ?? new Prisma.Decimal(0)),
      );

      let nextCursor: string | null = null;
      if (items.length > take) {
        const next = items.pop()!;
        nextCursor = next.id;
      }

      const data = items.map((i) => {
        const pool = i.poolAmount ?? new Prisma.Decimal(0); // if nullable
        const locked = sumMap.get(i.id) ?? new Prisma.Decimal(0);

        // Decimal math:
        const available = pool.sub(locked);

        const effectiveStatus =
          i.status === 'CLOSED'
            ? 'CLOSED'
            : available.eq(0) // or: available.cmp(0) <= 0
              ? 'EXHAUSTED'
              : i.status;

        return {
          id: i.id,
          creatorAddress: i.creatorAddress,
          routeId: i.routeId,
          adTokenId: i.adTokenId,
          orderTokenId: i.orderTokenId,
          poolAmount: i.poolAmount.toFixed(0),
          availableAmount: available.toFixed(0),
          minAmount: i.minAmount ? i.minAmount.toFixed(0) : null,
          maxAmount: i.maxAmount ? i.maxAmount.toFixed(0) : null,
          status: i.status != 'INACTIVE' ? effectiveStatus : i.status,
          metadata: i.metadata ?? null,
          createdAt: i.createdAt.toISOString(),
          updatedAt: i.updatedAt.toISOString(),
          adToken: {
            name: i.adToken.name,
            symbol: i.adToken.symbol,
            address: i.adToken.address,
            decimals: i.adToken.decimals,
            chainId: i.adToken.chain.chainId.toString(),
            kind: i.adToken.kind as string,
          },
          orderToken: {
            name: i.orderToken.name,
            symbol: i.orderToken.symbol,
            address: i.orderToken.address,
            decimals: i.orderToken.decimals,
            chainId: i.orderToken.chain.chainId.toString(),
            kind: i.orderToken.kind as string,
          },
        };
      });
      return { data, nextCursor };
    } catch (e) {
      if (e instanceof Error) {
        const status = e.message.toLowerCase().includes('forbidden')
          ? HttpStatus.FORBIDDEN
          : e.message.toLowerCase().includes('not found')
            ? HttpStatus.NOT_FOUND
            : HttpStatus.BAD_REQUEST;

        throw new HttpException(e.message, status);
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getById(id: string) {
    try {
      const ad = await this.prisma.ad.findUnique({
        where: { id },
        select: {
          id: true,
          creatorAddress: true,
          routeId: true,
          adTokenId: true,
          orderTokenId: true,
          poolAmount: true,
          minAmount: true,
          maxAmount: true,
          status: true,
          metadata: true,
          adToken: {
            select: {
              chain: { select: { chainId: true } },
              address: true,
              symbol: true,
              name: true,
              decimals: true,
              kind: true,
            },
          },
          orderToken: {
            select: {
              chain: { select: { chainId: true } },
              address: true,
              symbol: true,
              name: true,
              decimals: true,
              kind: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!ad) throw new NotFoundException('Ad not found');

      const lockSum = await this.prisma.adLock.aggregate({
        where: { adId: ad.id, releasedAt: null },
        _sum: { amount: true },
      });

      const locked = lockSum._sum.amount ?? new Prisma.Decimal(0);

      const available = ad.poolAmount.sub(locked);

      const effectiveStatus =
        ad.status === 'CLOSED'
          ? 'CLOSED'
          : available.eq(0)
            ? 'EXHAUSTED'
            : ad.status;

      return {
        id: ad.id,
        creatorAddress: ad.creatorAddress,
        routeId: ad.routeId,
        adTokenId: ad.adTokenId,
        orderTokenId: ad.orderTokenId,
        poolAmount: ad.poolAmount.toFixed(0),
        availableAmount: available.toFixed(0),
        minAmount: ad.minAmount ? ad.minAmount.toFixed(0) : null,
        maxAmount: ad.maxAmount ? ad.maxAmount.toFixed(0) : null,
        status: ad.status != 'INACTIVE' ? effectiveStatus : ad.status,
        adToken: {
          name: ad.adToken.name,
          symbol: ad.adToken.symbol,
          address: ad.adToken.address,
          decimals: ad.adToken.decimals,
          chainId: ad.adToken.chain.chainId.toString(),
          kind: ad.adToken.kind as string,
        },
        orderToken: {
          name: ad.orderToken.name,
          symbol: ad.orderToken.symbol,
          address: ad.orderToken.address,
          decimals: ad.orderToken.decimals,
          chainId: ad.orderToken.chain.chainId.toString(),
          kind: ad.orderToken.kind as string,
        },
        metadata: ad.metadata ?? null,
        createdAt: ad.createdAt.toISOString(),
        updatedAt: ad.updatedAt.toISOString(),
      };
    } catch (e) {
      if (e instanceof Error) {
        if (e instanceof HttpException) throw e;
        const status = e.message.toLowerCase().includes('forbidden')
          ? HttpStatus.FORBIDDEN
          : e.message.toLowerCase().includes('not found')
            ? HttpStatus.NOT_FOUND
            : e.message.toLowerCase().includes('bad request')
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.INTERNAL_SERVER_ERROR;
        throw new HttpException(e.message, status);
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /* ---------- Creator actions ---------- */

  async create(req: Request, dto: CreateAdDto) {
    try {
      const reqUser = req.user;

      if (!reqUser) throw new ForbiddenException('Unauthorized');

      const user = await this.prisma.user.findUnique({
        where: { id: reqUser.sub },
      });

      if (!user) throw new ForbiddenException('Unauthorized');

      // Pull route + tokens to validate same-symbol & cross-chain
      const route = await this.prisma.route.findUnique({
        where: { id: dto.routeId },
        select: {
          id: true,
          adToken: {
            select: {
              id: true,
              symbol: true,
              chain: {
                select: { chainId: true, adManagerAddress: true, kind: true },
              },
              address: true,
            },
          },
          orderToken: {
            select: {
              id: true,
              symbol: true,
              chain: { select: { chainId: true } },
            },
          },
        },
      });

      if (!route) throw new NotFoundException('Route not found');

      const adChainId = route.adToken.chain.chainId;
      const orderChainId = route.orderToken.chain.chainId;

      if (adChainId === orderChainId) {
        throw new BadRequestException('Route must be cross-chain');
      }

      const jsonData: Prisma.JsonObject = JSON.parse(
        JSON.stringify(dto.metadata || {}),
      ) as Prisma.JsonObject;

      const fundAmount = new Prisma.Decimal(dto.fundAmount);

      if (fundAmount.lte(0))
        throw new BadRequestException('fundAmount must be > 0');

      const minAmount = dto.minAmount
        ? new Prisma.Decimal(dto.minAmount)
        : new Prisma.Decimal(0);

      const maxAmount = dto.maxAmount
        ? new Prisma.Decimal(dto.maxAmount)
        : new Prisma.Decimal(0);

      if (minAmount && maxAmount && maxAmount.lt(minAmount)) {
        throw new BadRequestException(
          'maxAmount must be greater than minAmount',
        );
      }

      if (maxAmount && fundAmount.lt(maxAmount)) {
        throw new BadRequestException(
          'fundAmount must be greater than maxAmount',
        );
      }

      const adId = randomUUID();

      const reqContractDetails = await this.chainAdapters
        .forChain(route.adToken.chain.kind)
        .getCreateAdRequestContractDetails({
          adChainId: route.adToken.chain.chainId,
          adContractAddress: route.adToken.chain
            .adManagerAddress as `0x${string}`,
          adId: adId,
          orderChainId: route.orderToken.chain.chainId,
          adToken: route.adToken.address as `0x${string}`,
          initialAmount: fundAmount.toFixed(0),
          adRecipient: toBytes32(dto.creatorDstAddress),
        });

      const requestDetails = await this.prisma.$transaction(async (prisma) => {
        const ad = await prisma.ad.create({
          data: {
            id: adId,
            creatorAddress: getAddress(user.walletAddress),
            creatorDstAddress: getAddress(dto.creatorDstAddress),
            routeId: route.id,
            adTokenId: route.adToken.id,
            orderTokenId: route.orderToken.id,
            metadata: jsonData,
            status: 'INACTIVE',
            poolAmount: 0,
            minAmount: minAmount.gt(0) ? minAmount : null,
            maxAmount: maxAmount.gt(0) ? maxAmount : null,
          },
          select: {
            id: true,
            creatorDstAddress: true,
            status: true,
          },
        });

        await prisma.adUpdateLog.create({
          data: {
            adId: ad.id,
            signature: reqContractDetails.signature,
            reqHash: reqContractDetails.reqHash,
            log: {
              create: [
                {
                  field: 'Status',
                  oldValue: ad.status,
                  newValue: 'ACTIVE',
                },
                {
                  field: 'PoolAmount',
                  oldValue: '0',
                  newValue: fundAmount.toFixed(0),
                },
              ],
            },
          },
        });

        return reqContractDetails;
      });

      return requestDetails;
    } catch (e) {
      if (e instanceof Error) {
        if (e instanceof HttpException) throw e;
        const status = e.message.toLowerCase().includes('forbidden')
          ? HttpStatus.FORBIDDEN
          : e.message.toLowerCase().includes('not found')
            ? HttpStatus.NOT_FOUND
            : e.message.toLowerCase().includes('bad request')
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.INTERNAL_SERVER_ERROR;
        throw new HttpException(e.message, status);
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async fund(req: Request, id: string, dto: FundAdDto) {
    try {
      const reqUser = req.user;

      if (!reqUser) throw new ForbiddenException('Unauthorized');

      const user = await this.prisma.user.findUnique({
        where: { id: reqUser.sub },
      });

      if (!user) throw new ForbiddenException('Unauthorized');

      const ad = await this.prisma.ad.findUnique({
        where: { id, creatorAddress: getAddress(user.walletAddress) },
        select: {
          id: true,
          creatorAddress: true,
          status: true,
          poolAmount: true,
          route: {
            select: {
              adToken: {
                select: {
                  chain: {
                    select: {
                      adManagerAddress: true,
                      chainId: true,
                      kind: true,
                    },
                  },
                },
              },
            },
          },
          adUpdateLog: true,
        },
      });

      if (!ad) throw new NotFoundException('Ad not found');

      if (ad.adUpdateLog) {
        throw new BadRequestException(
          'Ad has pending update; please wait a few minutes and try again',
        );
      }

      const poolTopUp = new Prisma.Decimal(dto.poolAmountTopUp);

      if (poolTopUp.lte(0))
        throw new BadRequestException('poolAmountTopUp must be > 0');

      const effectiveStatus = ad.status == 'EXHAUSTED' ? 'ACTIVE' : ad.status;

      const reqContractDetails = await this.chainAdapters
        .forChain(ad.route.adToken.chain.kind)
        .getFundAdRequestContractDetails({
          adContractAddress: ad.route.adToken.chain
            .adManagerAddress as `0x${string}`,
          adChainId: ad.route.adToken.chain.chainId,
          adId: ad.id,
          amount: poolTopUp.toFixed(0),
        });

      const finalValue = ad.poolAmount.add(poolTopUp);

      await this.prisma.$transaction(async (prisma) => {
        const entry = await prisma.adUpdateLog.create({
          data: {
            adId: ad.id,
            signature: reqContractDetails.signature,
            reqHash: reqContractDetails.reqHash,
            log: {
              create: [
                {
                  field: 'PoolAmount',
                  oldValue: ad.poolAmount.toFixed(0),
                  newValue: finalValue.toFixed(0),
                },
                {
                  field: 'Status',
                  oldValue: ad.status,
                  newValue: effectiveStatus,
                },
              ],
            },
          },
        });

        // mark ad as PAUSED if ad is active as log is pending
        if (ad.status === 'ACTIVE') {
          await prisma.ad.update({
            where: { id: ad.id },
            data: { status: 'PAUSED' },
          });
        }

        return entry;
      });

      return reqContractDetails;
    } catch (e) {
      if (e instanceof Error) {
        if (e instanceof HttpException) throw e;
        const status = e.message.toLowerCase().includes('forbidden')
          ? HttpStatus.FORBIDDEN
          : e.message.toLowerCase().includes('not found')
            ? HttpStatus.NOT_FOUND
            : e.message.toLowerCase().includes('bad request')
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.INTERNAL_SERVER_ERROR;
        throw new HttpException(e.message, status);
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async withdraw(req: Request, id: string, dto: WithdrawalAdDto) {
    try {
      const reqUser = req.user;

      if (!reqUser) throw new ForbiddenException('Unauthorized');

      const user = await this.prisma.user.findUnique({
        where: { id: reqUser.sub },
      });

      if (!user) throw new ForbiddenException('Unauthorized');

      const ad = await this.prisma.ad.findUnique({
        where: { id, creatorAddress: getAddress(user.walletAddress) },
        select: {
          id: true,
          creatorAddress: true,
          status: true,
          poolAmount: true,
          route: {
            select: {
              adToken: {
                select: {
                  chain: {
                    select: {
                      adManagerAddress: true,
                      chainId: true,
                      kind: true,
                    },
                  },
                },
              },
            },
          },
          adUpdateLog: true,
        },
      });

      if (!ad) throw new NotFoundException('Ad not found');

      if (ad.adUpdateLog) {
        throw new BadRequestException(
          'Ad has pending update; please wait a few minutes and try again',
        );
      }

      const withdrawAmt = new Prisma.Decimal(dto.poolAmountWithdraw);

      if (withdrawAmt.lte(0))
        throw new BadRequestException('poolAmountWithdraw must be > 0');

      // get locksum
      const lockSum = await this.prisma.adLock.aggregate({
        where: { adId: ad.id, releasedAt: null },
        _sum: { amount: true },
      });

      const locked = lockSum._sum.amount ?? new Prisma.Decimal(0);
      const available = ad.poolAmount.sub(locked);

      console.log(available, withdrawAmt);

      if (withdrawAmt.gt(available))
        throw new BadRequestException('Insufficient available balance');

      const effectiveStatus = available.sub(withdrawAmt).eq(0)
        ? 'EXHAUSTED'
        : ad.status;

      const reqContractDetails = await this.chainAdapters
        .forChain(ad.route.adToken.chain.kind)
        .getWithdrawFromAdRequestContractDetails({
          adContractAddress: ad.route.adToken.chain
            .adManagerAddress as `0x${string}`,
          adChainId: ad.route.adToken.chain.chainId,
          adId: ad.id,
          amount: withdrawAmt.toFixed(0),
          to: dto.to as `0x${string}`,
        });

      const finalValue = ad.poolAmount.sub(withdrawAmt);

      await this.prisma.$transaction(async (prisma) => {
        await prisma.adUpdateLog.create({
          data: {
            adId: ad.id,
            signature: reqContractDetails.signature,
            reqHash: reqContractDetails.reqHash,
            log: {
              create: [
                {
                  field: 'PoolAmount',
                  oldValue: ad.poolAmount.toFixed(0),
                  newValue: finalValue.toFixed(0),
                },
                {
                  field: 'Status',
                  oldValue: ad.status,
                  newValue: effectiveStatus,
                },
              ],
            },
          },
        });

        // mark ad as PAUSED if it was ACTIVE as log is pending
        if (ad.status === 'ACTIVE') {
          await prisma.ad.update({
            where: { id: ad.id },
            data: { status: 'PAUSED' },
          });
        }
      });

      return reqContractDetails;
    } catch (e) {
      if (e instanceof Error) {
        if (e instanceof HttpException) throw e;
        const status = e.message.toLowerCase().includes('forbidden')
          ? HttpStatus.FORBIDDEN
          : e.message.toLowerCase().includes('not found')
            ? HttpStatus.NOT_FOUND
            : e.message.toLowerCase().includes('bad request')
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.INTERNAL_SERVER_ERROR;
        throw new HttpException(e.message, status);
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(req: Request, id: string, dto: UpdateAdDto) {
    try {
      const reqUser = req.user;

      if (!reqUser) throw new ForbiddenException('Unauthorized');

      const user = await this.prisma.user.findUnique({
        where: { id: reqUser.sub },
      });

      if (!user) throw new ForbiddenException('Unauthorized');

      const ad = await this.prisma.ad.findUnique({
        where: { id },
        select: {
          id: true,
          creatorAddress: true,
          status: true,
        },
      });
      if (!ad) throw new NotFoundException('Ad not found');

      const data: AdUpdateInput = {};

      if (ad.status === 'INACTIVE' && dto.status) {
        throw new BadRequestException(
          'Cannot update status when ad is inactive',
        );
      }

      if (dto.minAmount !== undefined)
        data.minAmount = new Prisma.Decimal(dto.minAmount);
      if (dto.maxAmount !== undefined)
        data.maxAmount = new Prisma.Decimal(dto.maxAmount);
      if (dto.metadata !== undefined) data.metadata = dto.metadata;
      if (dto.status) data.status = dto.status;

      const updated = await this.prisma.ad.update({
        where: { id },
        data,
        select: {
          id: true,
          creatorAddress: true,
          minAmount: true,
          maxAmount: true,
          status: true,
          metadata: true,
        },
      });

      return {
        id: updated.id,
        status: updated.status,
        creatorAddress: updated.creatorAddress,
        minAmount: updated.minAmount ? updated.minAmount.toFixed(0) : null,
        maxAmount: updated.maxAmount ? updated.maxAmount.toFixed(0) : null,
        metadata: updated.metadata ?? null,
      };
    } catch (e) {
      if (e instanceof Error) {
        if (e instanceof HttpException) throw e;
        const status = e.message.toLowerCase().includes('forbidden')
          ? HttpStatus.FORBIDDEN
          : e.message.toLowerCase().includes('not found')
            ? HttpStatus.NOT_FOUND
            : e.message.toLowerCase().includes('bad request')
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.INTERNAL_SERVER_ERROR;
        throw new HttpException(e.message, status);
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async close(req: Request, id: string, dto: CloseAdDto) {
    try {
      const reqUser = req.user;

      if (!reqUser) throw new ForbiddenException('Unauthorized');

      const user = await this.prisma.user.findUnique({
        where: { id: reqUser.sub },
      });

      if (!user) throw new ForbiddenException('Unauthorized');

      const ad = await this.prisma.ad.findFirst({
        where: { id, creatorAddress: getAddress(user.walletAddress) },
        select: {
          id: true,
          creatorAddress: true,
          status: true,
          poolAmount: true,
          route: {
            select: {
              adToken: {
                select: {
                  chain: {
                    select: {
                      adManagerAddress: true,
                      chainId: true,
                      kind: true,
                    },
                  },
                },
              },
            },
          },
          adUpdateLog: true,
        },
      });
      if (!ad) throw new NotFoundException('Ad not found');

      if (ad.adUpdateLog) {
        throw new BadRequestException(
          'Ad has pending update; please wait a few minutes and try again',
        );
      }

      // get locksum and ensure none are active
      const lockSum = await this.prisma.adLock.aggregate({
        where: { adId: ad.id, releasedAt: null },
        _sum: { amount: true },
      });

      const locked = lockSum._sum.amount ?? new Prisma.Decimal(0);

      if (locked.gt(0))
        throw new BadRequestException(
          'Ad has active locks and cannot be closed',
        );

      if (ad.status === 'CLOSED') {
        throw new BadRequestException('Ad is already closed');
      }

      const reqContractDetails = await this.chainAdapters
        .forChain(ad.route.adToken.chain.kind)
        .getCloseAdRequestContractDetails({
          adContractAddress: ad.route.adToken.chain
            .adManagerAddress as `0x${string}`,
          adChainId: ad.route.adToken.chain.chainId,
          adId: ad.id,
          to: dto.to as `0x${string}`,
        });

      await this.prisma.$transaction(async (prisma) => {
        await prisma.adUpdateLog.create({
          data: {
            adId: ad.id,
            signature: reqContractDetails.signature,
            reqHash: reqContractDetails.reqHash,
            log: {
              create: [
                {
                  field: 'PoolAmount',
                  oldValue: ad.poolAmount.toFixed(0),
                  newValue: (0).toString(),
                },
                {
                  field: 'Status',
                  oldValue: ad.status,
                  newValue: 'CLOSED',
                },
              ],
            },
          },
        });

        // mark ad as PAUSED if it was ACTIVE as log is pending
        if (ad.status === 'ACTIVE') {
          await prisma.ad.update({
            where: { id: ad.id },
            data: { status: 'PAUSED' },
          });
        }
      });

      return reqContractDetails;
    } catch (e) {
      if (e instanceof Error) {
        if (e instanceof HttpException) throw e;
        const status = e.message.toLowerCase().includes('forbidden')
          ? HttpStatus.FORBIDDEN
          : e.message.toLowerCase().includes('not found')
            ? HttpStatus.NOT_FOUND
            : e.message.toLowerCase().includes('bad request')
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.INTERNAL_SERVER_ERROR;
        throw new HttpException(e.message, status);
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async confirmChainAction(
    req: Request,
    adId: string,
    dto: ConfirmAdActionDto,
  ) {
    try {
      const reqUser = req.user;

      if (!reqUser) throw new ForbiddenException('Unauthorized');

      const user = await this.prisma.user.findUnique({
        where: { id: reqUser.sub },
      });

      if (!user) throw new ForbiddenException('Unauthorized');

      const adLogUpdate = await this.prisma.adUpdateLog.findUnique({
        where: { adId },
        include: { ad: true, log: true },
      });

      if (!adLogUpdate) throw new NotFoundException('Ad update log not found');

      if (
        getAddress(adLogUpdate.ad.creatorAddress) !==
        getAddress(user.walletAddress)
      ) {
        throw new ForbiddenException('Unauthorized');
      }

      // get ad details
      const ad = await this.prisma.ad.findUnique({
        where: { id: adId },
        select: {
          poolAmount: true,
          status: true,
          route: {
            select: {
              adToken: {
                select: {
                  chain: {
                    select: {
                      adManagerAddress: true,
                      chainId: true,
                      kind: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!ad) throw new NotFoundException('Ad for Ad Id not found');

      // // verify adLog
      const isValidated = await this.chainAdapters
        .forChain(ad.route.adToken.chain.kind)
        .validateAdManagerRequest({
          chainId: ad.route.adToken.chain.chainId,
          contractAddress: ad.route.adToken.chain
            .adManagerAddress as `0x${string}`,
          reqHash: adLogUpdate.reqHash as `0x${string}`,
        });

      if (!isValidated)
        throw new BadRequestException('Invalid request; please try again');

      // apply the updates
      const updates: AdUpdateLogInput = {};

      adLogUpdate.log.forEach((entry) => {
        if (entry.field === 'PoolAmount') {
          updates.poolAmount = entry.newValue;
        } else if (entry.field === 'Status') {
          updates.status = entry.newValue as AdStatus;
        }
      });

      await this.prisma.$transaction([
        this.prisma.ad.update({
          where: { id: adLogUpdate.adId },
          data: {
            poolAmount: updates.poolAmount ? updates.poolAmount : ad.poolAmount,
            status: updates.status ? updates.status : ad.status,
          },
        }),

        this.prisma.adUpdateLog.delete({ where: { id: adLogUpdate.id } }),
      ]);

      console.log(dto);

      return {
        adId: adId,
        success: true,
      };
    } catch (e) {
      if (e instanceof Error) {
        if (e instanceof HttpException) throw e;
        const status = e.message.toLowerCase().includes('forbidden')
          ? HttpStatus.FORBIDDEN
          : e.message.toLowerCase().includes('not found')
            ? HttpStatus.NOT_FOUND
            : e.message.toLowerCase().includes('bad request')
              ? HttpStatus.BAD_REQUEST
              : HttpStatus.INTERNAL_SERVER_ERROR;
        throw new HttpException(e.message, status);
      }
      throw new HttpException(
        'Unknown error occurred',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
