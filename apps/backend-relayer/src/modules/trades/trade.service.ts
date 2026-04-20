import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import {
  ConfirmTradeActionDto,
  CreateTradeDto,
  QueryTradesDto,
  UnlockTradeDto,
} from './dto/trade.dto';
import { Request } from 'express';
import { ChainAdapterService } from '../../chain-adapters/chain-adapter.service';
import { MMRService } from '../mmr/mmr.service';
import { ProofService } from '../../providers/noir/proof.service';
import { randomUUID } from 'crypto';
import { Prisma, TradeStatus } from '@prisma/client';
import { EncryptionService } from '@libs/encryption.service';
import {
  normalizeChainAddress,
  toBytes32,
  uuidToBigInt,
} from '../../providers/viem/ethers/typedData';
import { UserService } from '../user/user.service';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class TradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chainAdapters: ChainAdapterService,
    private readonly merkleService: MMRService,
    private readonly proofService: ProofService,
    private readonly encryptionService: EncryptionService,
    private readonly users: UserService,
    private readonly notifications: NotificationService,
  ) {}

  async getById(id: string) {
    try {
      const row = await this.prisma.trade.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          amount: true,
          adId: true,
          routeId: true,
          adCreatorAddress: true,
          bridgerAddress: true,
          createdAt: true,
          updatedAt: true,
          ad: {
            select: { id: true, creatorAddress: true, routeId: true },
          },
          route: {
            select: {
              id: true,
              adToken: {
                select: {
                  id: true,
                  symbol: true,
                  chain: { select: { name: true, chainId: true, kind: true } },
                  kind: true,
                  address: true,
                  decimals: true,
                },
              },
              orderToken: {
                select: {
                  id: true,
                  symbol: true,
                  chain: { select: { name: true, chainId: true, kind: true } },
                  kind: true,
                  address: true,
                  decimals: true,
                },
              },
            },
          },
          bridgerClaimed: true,
          adCreatorClaimed: true,
        },
      });
      if (!row) throw new NotFoundException('Trade not found');

      const orderChainId = row.route.orderToken.chain.chainId.toString();
      const adChainId = row.route.adToken.chain.chainId.toString();

      return {
        ...row,
        amount: row.amount.toFixed(0),
        adChainId: adChainId,
        orderChainId: orderChainId,
        route: {
          ...row.route,
          adToken: {
            ...row.route.adToken,
            chain: {
              ...row.route.adToken.chain,
              chainId: adChainId,
            },
            kind: row.route.adToken.kind as string,
          },
          orderToken: {
            ...row.route.orderToken,
            chain: {
              ...row.route.orderToken.chain,
              chainId: orderChainId,
            },
            kind: row.route.orderToken.kind as string,
          },
        },
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

  async list(q: QueryTradesDto) {
    try {
      const take = q.limit && q.limit > 0 && q.limit <= 100 ? q.limit : 25;
      const cursor = q.cursor ? { id: q.cursor } : undefined;

      const where: Prisma.TradeWhereInput = {};

      if (q.routeId) where.routeId = q.routeId;
      if (q.adId) where.adId = q.adId;
      if (q.status) {
        where.status = Array.isArray(q.status) ? { in: q.status } : q.status;
      }
      try {
        if (q.participantAddresses && q.participantAddresses.length > 0) {
          const normalized = q.participantAddresses.map((a) =>
            normalizeChainAddress(a),
          );
          where.OR = [
            { adCreatorAddress: { in: normalized } },
            { bridgerAddress: { in: normalized } },
          ];
        } else {
          if (q.adCreatorAddress) {
            const list = Array.isArray(q.adCreatorAddress)
              ? q.adCreatorAddress
              : [q.adCreatorAddress];
            const normalized = list.map((a) => normalizeChainAddress(a));
            where.adCreatorAddress =
              normalized.length === 1 ? normalized[0] : { in: normalized };
          }
          if (q.bridgerAddress) {
            const list = Array.isArray(q.bridgerAddress)
              ? q.bridgerAddress
              : [q.bridgerAddress];
            const normalized = list.map((a) => normalizeChainAddress(a));
            where.bridgerAddress =
              normalized.length === 1 ? normalized[0] : { in: normalized };
          }
        }
      } catch {
        throw new BadRequestException('Invalid address filter');
      }

      if (q.adTokenId || q.orderTokenId) {
        where.route = {
          ...(q.adTokenId && { adTokenId: q.adTokenId }),
          ...(q.orderTokenId && { orderTokenId: q.orderTokenId }),
        };
      }

      if (q.minAmount || q.maxAmount) {
        where.amount = {
          ...(q.minAmount ? { gte: BigInt(q.minAmount) } : {}),
          ...(q.maxAmount ? { lte: BigInt(q.maxAmount) } : {}),
        } as Prisma.DecimalFilter;
      }

      const rows = await this.prisma.trade.findMany({
        where,
        orderBy: { id: 'asc' },
        take: take + 1,
        ...(cursor ? { cursor, skip: 1 } : {}),
        select: {
          id: true,
          status: true,
          amount: true,
          adId: true,
          routeId: true,
          adCreatorAddress: true,
          bridgerAddress: true,
          ad: {
            select: { id: true, creatorAddress: true, routeId: true },
          },
          route: {
            select: {
              id: true,
              adToken: {
                select: {
                  id: true,
                  symbol: true,
                  chain: { select: { name: true, chainId: true, kind: true } },
                  kind: true,
                  address: true,
                  decimals: true,
                },
              },
              orderToken: {
                select: {
                  id: true,
                  symbol: true,
                  chain: { select: { name: true, chainId: true, kind: true } },
                  kind: true,
                  address: true,
                  decimals: true,
                },
              },
            },
          },
          createdAt: true,
          updatedAt: true,
          adCreatorClaimed: true,
          bridgerClaimed: true,
        },
      });

      let nextCursor: string | null = null;
      if (rows.length > take) {
        const next = rows.pop()!;
        nextCursor = next.id;
      }

      const cleanedRows = rows.map((row) => {
        const orderChainId = row.route.orderToken.chain.chainId.toString();
        const adChainId = row.route.adToken.chain.chainId.toString();
        return {
          ...row,
          status: row.status as string,
          amount: row.amount.toFixed(0),
          adChainId: adChainId,
          orderChainId: orderChainId,
          route: {
            ...row.route,
            adToken: {
              ...row.route.adToken,
              chain: {
                ...row.route.adToken.chain,
                chainId: adChainId,
              },
              kind: row.route.adToken.kind as string,
            },
            orderToken: {
              ...row.route.orderToken,
              chain: {
                ...row.route.orderToken.chain,
                chainId: orderChainId,
              },
              kind: row.route.orderToken.kind as string,
            },
          },
        };
      });

      return { data: cleanedRows, nextCursor };
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

  // creates a new trade along with ad lock
  async create(req: Request, dto: CreateTradeDto) {
    try {
      const reqUser = req.user;

      if (!reqUser) throw new UnauthorizedException('Not authenticated');

      const ad = await this.prisma.ad
        .findUnique({
          where: { id: dto.adId },
          select: {
            route: {
              select: {
                id: true,
                orderToken: {
                  select: {
                    address: true,
                    decimals: true,
                    chain: {
                      select: {
                        orderPortalAddress: true,
                        chainId: true,
                        mmrId: true,
                        kind: true,
                      },
                    },
                  },
                },
                adToken: {
                  select: {
                    address: true,
                    decimals: true,
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
            id: true,
            creatorAddress: true,
            creatorDstAddress: true,
            routeId: true,
            poolAmount: true,
            minAmount: true,
            maxAmount: true,
            status: true,
            adUpdateLog: true,
          },
        })
        .catch(() => null);

      if (!ad) {
        throw new NotFoundException('Ad not found');
      }

      if (ad.adUpdateLog) {
        throw new BadRequestException(
          'Ad has a pending update, please try again later',
        );
      }

      if (ad.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Ad not ACTIVE, current status: ${ad.status}`,
        );
      }

      const bridgerAddress = await this.users.getWalletForChain(
        reqUser.sub,
        ad.route.orderToken.chain.kind,
      );

      const callerLinked = await this.users.getLinkedAddresses(reqUser.sub);
      if (callerLinked.has(ad.creatorAddress)) {
        throw new BadRequestException(
          'Ad creator cannot create trade on own ad',
        );
      }

      let normalizedBridgerDst: string;
      try {
        normalizedBridgerDst = normalizeChainAddress(
          dto.bridgerDstAddress,
          ad.route.adToken.chain.kind,
        );
      } catch {
        throw new BadRequestException('Invalid bridgerDstAddress');
      }

      const orderAmount = new Prisma.Decimal(dto.amount);
      const orderDecimals = ad.route.orderToken.decimals;
      const adDecimals = ad.route.adToken.decimals;
      const scale = new Prisma.Decimal(10).pow(
        Math.abs(adDecimals - orderDecimals),
      );
      const adAmount =
        adDecimals >= orderDecimals
          ? orderAmount.mul(scale)
          : orderAmount.div(scale);
      if (!adAmount.isInteger()) {
        throw new BadRequestException(
          'Amount not representable in ad-token decimals',
        );
      }

      if (ad.minAmount && adAmount.lt(ad.minAmount)) {
        throw new BadRequestException('Amount below minAmount');
      }
      if (ad.maxAmount && adAmount.gt(ad.maxAmount)) {
        throw new BadRequestException('Amount above maxAmount');
      }

      // available = pool - sum(locks not released)
      const lockSum = await this.prisma.adLock.aggregate({
        where: { adId: ad.id, releasedAt: null },
        _sum: { amount: true },
      });
      const locked = lockSum._sum.amount ?? new Prisma.Decimal(0);
      const available = ad.poolAmount.sub(locked);
      if (adAmount.gt(available))
        throw new BadRequestException('Insufficient liquidity');

      const secret = this.proofService.generateSecret();
      const tradeId = randomUUID();

      const reqContractDetails = await this.chainAdapters
        .forChain(ad.route.orderToken.chain.kind)
        .getCreateOrderRequestContractDetails({
          orderChainId: ad.route.orderToken.chain.chainId,
          orderContractAddress: ad.route.orderToken.chain
            .orderPortalAddress as `0x${string}`,
          orderParams: {
            orderChainToken: toBytes32(ad.route.orderToken.address),
            adChainToken: toBytes32(ad.route.adToken.address),
            amount: orderAmount.toFixed(0),
            bridger: toBytes32(bridgerAddress),
            orderChainId: ad.route.orderToken.chain.chainId.toString(),
            orderPortal: toBytes32(
              ad.route.orderToken.chain.orderPortalAddress,
            ),
            orderRecipient: toBytes32(normalizedBridgerDst),
            adChainId: ad.route.adToken.chain.chainId.toString(),
            adManager: toBytes32(ad.route.adToken.chain.adManagerAddress),
            adId: ad.id,
            adCreator: toBytes32(ad.creatorAddress),
            adRecipient: toBytes32(ad.creatorDstAddress),
            salt: tradeId,
            orderDecimals,
            adDecimals,
          },
        });

      // Persist in a single transaction: then AdLock
      const result = await this.prisma.$transaction(async (tx) => {
        const trade = await tx.trade.create({
          data: {
            id: tradeId,
            adId: ad.id,
            routeId: ad.route.id,
            amount: orderAmount.toFixed(0),
            adCreatorAddress: normalizeChainAddress(ad.creatorAddress),
            adCreatorDstAddress: normalizeChainAddress(ad.creatorDstAddress),
            bridgerAddress: normalizeChainAddress(bridgerAddress),
            bridgerDstAddress: normalizedBridgerDst,
            orderHash: reqContractDetails.orderHash,
          },
          select: { id: true, status: true },
        });

        await tx.adLock.create({
          // AdLock accounts against ad.poolAmount, which is in adToken units.
          data: { adId: ad.id, tradeId: trade.id, amount: adAmount },
        });

        // create trade update log to make status active
        await tx.tradeUpdateLog.create({
          data: {
            tradeId: trade.id,
            origin: 'ORDER_PORTAL',
            signature: reqContractDetails.signature,
            reqHash: reqContractDetails.reqHash,
            ctx: 'CREATEORDER',
            log: {
              create: [
                {
                  field: 'Status',
                  oldValue: trade.status,
                  newValue: 'ACTIVE',
                },
              ],
            },
          },
        });

        const encrypted = await this.encryptionService.encryptSecret(secret);

        await tx.secret.create({
          data: {
            tradeId: trade.id,
            iv: encrypted.iv,
            secretCipherText: encrypted.ciphertext,
            secretHash: encrypted.secretHash,
            authTag: encrypted.authTag,
          },
        });

        return { tradeId: trade.id, reqContractDetails };
      });

      // Notify the ad creator that a new order landed on their ad
      await this.notifications.safeCreateForAddress(
        ad.creatorAddress,
        {
          type: 'TRADE_CREATED',
          tradeId: result.tradeId,
          title: 'New order on your ad',
          body: `A bridger placed an order from ${ad.route.orderToken.chain.kind === 'EVM' ? 'EVM' : 'Stellar'} to ${ad.route.adToken.chain.kind === 'EVM' ? 'EVM' : 'Stellar'}.`,
          payload: {
            adId: ad.id,
            amount: orderAmount.toFixed(0),
          },
        },
        ad.route.adToken.chain.kind,
      );

      return {
        ...result,
        reqContractDetails: {
          ...result.reqContractDetails,
          chainKind: ad.route.orderToken.chain.kind as string,
        },
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

  async params(req: Request, tradeId: string) {
    try {
      const reqUser = req.user;
      if (!reqUser) throw new UnauthorizedException('Not authenticated');

      const trade = await this.prisma.trade.findFirst({
        where: { id: tradeId },
        select: {
          id: true,
          adId: true,
          amount: true,
          adLock: true,
          status: true,
          tradeUpdateLog: true,
          orderHash: true,
          bridgerAddress: true,
          bridgerDstAddress: true,
          adCreatorDstAddress: true,
          adCreatorAddress: true,
          route: {
            select: {
              adToken: {
                select: {
                  address: true,
                  decimals: true,
                  chain: {
                    select: {
                      chainId: true,
                      adManagerAddress: true,
                      mmrId: true,
                      kind: true,
                    },
                  },
                },
              },
              orderToken: {
                select: {
                  address: true,
                  decimals: true,
                  chain: {
                    select: {
                      chainId: true,
                      orderPortalAddress: true,
                      kind: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!trade) throw new NotFoundException('Trade not found');

      const callerLinked = await this.users.getLinkedAddresses(reqUser.sub);
      const isBridger = callerLinked.has(
        normalizeChainAddress(trade.bridgerAddress),
      );
      const isAdCreator = callerLinked.has(
        normalizeChainAddress(trade.adCreatorAddress),
      );

      if (!isBridger && !isAdCreator) {
        throw new ForbiddenException('Unauthorized');
      }

      const unlockChainKind = isAdCreator
        ? trade.route.orderToken.chain.kind
        : trade.route.adToken.chain.kind;

      return {
        orderChainToken: toBytes32(trade.route.orderToken.address),
        adChainToken: toBytes32(trade.route.adToken.address),
        amount: trade.amount.toFixed(0),
        bridger: toBytes32(trade.bridgerAddress),
        orderChainId: trade.route.orderToken.chain.chainId.toString(),
        orderPortal: toBytes32(trade.route.orderToken.chain.orderPortalAddress),
        orderRecipient: toBytes32(trade.bridgerDstAddress),
        adChainId: trade.route.adToken.chain.chainId.toString(),
        adManager: toBytes32(trade.route.adToken.chain.adManagerAddress),
        adId: trade.adId,
        adCreator: toBytes32(trade.adCreatorAddress),
        adRecipient: toBytes32(trade.adCreatorDstAddress),
        salt: uuidToBigInt(trade.id).toString(),
        orderDecimals: trade.route.orderToken.decimals,
        adDecimals: trade.route.adToken.decimals,
        orderHash: trade.orderHash,
        unlockChainKind,
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

  async lockTrade(req: Request, tradeId: string) {
    try {
      const reqUser = req.user;
      if (!reqUser) throw new UnauthorizedException('Not authenticated');

      const trade = await this.prisma.trade.findFirst({
        where: { id: tradeId },
        select: {
          id: true,
          adId: true,
          amount: true,
          adLock: true,
          status: true,
          tradeUpdateLog: true,
          bridgerAddress: true,
          bridgerDstAddress: true,
          adCreatorDstAddress: true,
          adCreatorAddress: true,
          route: {
            select: {
              adToken: {
                select: {
                  address: true,
                  decimals: true,
                  chain: {
                    select: {
                      chainId: true,
                      adManagerAddress: true,
                      mmrId: true,
                      kind: true,
                    },
                  },
                },
              },
              orderToken: {
                select: {
                  address: true,
                  decimals: true,
                  chain: {
                    select: {
                      chainId: true,
                      orderPortalAddress: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!trade) throw new NotFoundException('Trade not found');

      // Only the ad creator can lock. Their adCreatorAddress is on the
      // ad chain — ensure the caller has that exact wallet linked.
      const callerAdChainWallet = await this.users.getWalletForChain(
        reqUser.sub,
        trade.route.adToken.chain.kind,
      );
      if (
        normalizeChainAddress(callerAdChainWallet) !==
        normalizeChainAddress(trade.adCreatorAddress)
      ) {
        throw new ForbiddenException('Unauthorized');
      }

      if (trade.tradeUpdateLog) {
        throw new BadRequestException(
          'Trade already has a pending update, please try again later',
        );
      }

      if (trade.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Trade not ACTIVE, current status: ${trade.status}`,
        );
      }

      if (trade.adLock && trade.adLock.authorized) {
        throw new BadRequestException('Trade is already locked');
      }

      const orderDecimals = trade.route.orderToken.decimals;
      const adDecimals = trade.route.adToken.decimals;

      if (trade.adLock) {
        const scale = new Prisma.Decimal(10).pow(
          Math.abs(adDecimals - orderDecimals),
        );
        const expectedAdAmount =
          adDecimals >= orderDecimals
            ? trade.amount.mul(scale)
            : trade.amount.div(scale);
        if (!trade.adLock.amount.eq(expectedAdAmount)) {
          throw new BadRequestException('AdLock amount mismatch');
        }
      }

      const reqContractDetails = await this.chainAdapters
        .forChain(trade.route.adToken.chain.kind)
        .getLockForOrderRequestContractDetails({
          adChainId: trade.route.adToken.chain.chainId,
          adContractAddress: trade.route.adToken.chain
            .adManagerAddress as `0x${string}`,
          orderParams: {
            orderChainToken: toBytes32(trade.route.orderToken.address),
            adChainToken: toBytes32(trade.route.adToken.address),
            amount: trade.amount.toFixed(0),
            bridger: toBytes32(trade.bridgerAddress),
            orderChainId: trade.route.orderToken.chain.chainId.toString(),
            orderPortal: toBytes32(
              trade.route.orderToken.chain.orderPortalAddress,
            ),
            orderRecipient: toBytes32(trade.bridgerDstAddress),
            adChainId: trade.route.adToken.chain.chainId.toString(),
            adManager: toBytes32(trade.route.adToken.chain.adManagerAddress),
            adId: trade.adId,
            adCreator: toBytes32(trade.adCreatorAddress),
            adRecipient: toBytes32(trade.adCreatorDstAddress),
            salt: trade.id,
            orderDecimals,
            adDecimals,
          },
        });

      // create trade update log to make status locked
      await this.prisma.tradeUpdateLog.create({
        data: {
          tradeId: trade.id,
          origin: 'AD_MANAGER',
          signature: reqContractDetails.signature,
          reqHash: reqContractDetails.reqHash,
          ctx: 'LOCKORDER',
          log: {
            create: [
              {
                field: 'Status',
                oldValue: trade.status,
                newValue: 'LOCKED',
              },
              {
                field: 'AdLock',
                oldValue: 'false',
                newValue: 'true',
              },
            ],
          },
        },
      });

      return {
        ...reqContractDetails,
        chainKind: trade.route.adToken.chain.kind as string,
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

  async unlock(req: Request, id: string, dto: UnlockTradeDto) {
    try {
      const reqUser = req.user;
      if (!reqUser) throw new UnauthorizedException('Not authenticated');

      const trade = await this.prisma.trade.findUnique({
        where: { id },
        select: {
          id: true,
          adId: true,
          status: true,
          bridgerAddress: true,
          adCreatorAddress: true,
          bridgerDstAddress: true,
          adCreatorDstAddress: true,
          orderHash: true,
          amount: true,
          adCreatorClaimed: true,
          bridgerClaimed: true,
          route: {
            select: {
              adToken: {
                select: {
                  address: true,
                  decimals: true,
                  chain: {
                    select: {
                      adManagerAddress: true,
                      chainId: true,
                      mmrId: true,
                      kind: true,
                    },
                  },
                },
              },
              orderToken: {
                select: {
                  address: true,
                  decimals: true,
                  chain: {
                    select: {
                      orderPortalAddress: true,
                      chainId: true,
                      mmrId: true,
                      kind: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!trade) throw new NotFoundException('Trade not found');

      const callerLinked = await this.users.getLinkedAddresses(reqUser.sub);
      const isBridger = callerLinked.has(
        normalizeChainAddress(trade.bridgerAddress),
      );
      const isAdCreator = callerLinked.has(
        normalizeChainAddress(trade.adCreatorAddress),
      );

      if (!isBridger && !isAdCreator) {
        throw new UnauthorizedException('Not a participant');
      }

      // ensure that trade status is locked
      if (trade.status !== 'LOCKED') {
        throw new BadRequestException(
          `Trade status must be LOCKED to confirm, got ${trade.status}`,
        );
      }

      const unlockChain = isAdCreator
        ? trade.route.orderToken.chain
        : trade.route.adToken.chain;

      const unlockSigner = normalizeChainAddress(
        isAdCreator ? trade.adCreatorDstAddress : trade.bridgerDstAddress,
        unlockChain.kind,
      );

      const orderParams = {
        orderChainToken: toBytes32(trade.route.orderToken.address),
        adChainToken: toBytes32(trade.route.adToken.address),
        amount: trade.amount.toFixed(0),
        bridger: toBytes32(trade.bridgerAddress),
        orderChainId: trade.route.orderToken.chain.chainId.toString(),
        orderPortal: toBytes32(trade.route.orderToken.chain.orderPortalAddress),
        orderRecipient: toBytes32(trade.bridgerDstAddress),
        adChainId: trade.route.adToken.chain.chainId.toString(),
        adManager: toBytes32(trade.route.adToken.chain.adManagerAddress),
        adId: trade.adId,
        adCreator: toBytes32(trade.adCreatorAddress),
        adRecipient: toBytes32(trade.adCreatorDstAddress),
        salt: uuidToBigInt(trade.id).toString(),
        orderDecimals: trade.route.orderToken.decimals,
        adDecimals: trade.route.adToken.decimals,
      };

      const isAuthorized = this.chainAdapters
        .forChain(unlockChain.kind)
        .verifyOrderSignature(
          unlockSigner as `0x${string}`,
          trade.orderHash as `0x${string}`,
          orderParams,
          dto.signature,
        );

      if (!isAuthorized) {
        throw new BadRequestException('Invalid User Signature');
      }

      if (trade.adCreatorClaimed && isAdCreator) {
        throw new BadRequestException('Ad Creator has already authorized');
      }

      if (trade.bridgerClaimed && !isAdCreator) {
        throw new BadRequestException('Bridger has already authorized');
      }

      // get the secret
      const tradeSecret = await this.prisma.secret.findUnique({
        where: { tradeId: trade.id },
      });

      if (!tradeSecret) {
        throw new NotFoundException('Secret not found for trade');
      }

      let mmrId: string;
      if (isAdCreator) {
        mmrId = trade.route.orderToken.chain.mmrId;
      } else {
        mmrId = trade.route.adToken.chain.mmrId;
      }

      // get merkle proof
      const merkleProof = await this.merkleService.getMerkleProof(
        mmrId,
        trade.orderHash,
      );

      const localRoot = await this.merkleService.getRoot(mmrId);

      const rootExists = await this.chainAdapters
        .forChain(unlockChain.kind)
        .checkLocalRootExist(localRoot, isAdCreator, {
          chainId: unlockChain.chainId,
          contractAddress: isAdCreator
            ? (trade.route.orderToken.chain.orderPortalAddress as `0x${string}`)
            : (trade.route.adToken.chain.adManagerAddress as `0x${string}`),
        });

      if (!rootExists) {
        throw new BadRequestException(
          'MMR root mismatch - chain is not up to date',
        );
      }

      const secret = this.encryptionService.decryptSecret({
        iv: tradeSecret.iv,
        ciphertext: tradeSecret.secretCipherText,
        authTag: tradeSecret.authTag,
      });

      const { proof } = await this.proofService.generateProof({
        merkleProof,
        orderHash: trade.orderHash,
        secret: secret,
        isAdCreator,
        targetRoot: localRoot,
      });

      const nullifierHash = await this.proofService.generateNullifierHash(
        secret,
        isAdCreator,
        trade.orderHash,
      );

      const requestContractDetails = await this.chainAdapters
        .forChain(unlockChain.kind)
        .getUnlockOrderContractDetails({
          chainId: unlockChain.chainId,
          contractAddress: isAdCreator
            ? (trade.route.orderToken.chain.orderPortalAddress as `0x${string}`)
            : (trade.route.adToken.chain.adManagerAddress as `0x${string}`),
          isAdCreator,
          orderParams: {
            orderChainToken: toBytes32(trade.route.orderToken.address),
            adChainToken: toBytes32(trade.route.adToken.address),
            amount: trade.amount.toFixed(0),
            bridger: toBytes32(trade.bridgerAddress),
            orderChainId: trade.route.orderToken.chain.chainId.toString(),
            orderPortal: toBytes32(
              trade.route.orderToken.chain.orderPortalAddress,
            ),
            orderRecipient: toBytes32(trade.bridgerDstAddress),
            adChainId: trade.route.adToken.chain.chainId.toString(),
            adManager: toBytes32(trade.route.adToken.chain.adManagerAddress),
            adId: trade.adId,
            adCreator: toBytes32(trade.adCreatorAddress),
            adRecipient: toBytes32(trade.adCreatorDstAddress),
            salt: trade.id,
            orderDecimals: trade.route.orderToken.decimals,
            adDecimals: trade.route.adToken.decimals,
          },
          nullifierHash: nullifierHash,
          targetRoot: localRoot,
          proof,
        });

      const callerUnlockWallet = await this.users.getWalletForChain(
        reqUser.sub,
        unlockChain.kind,
      );

      await this.prisma.authorizationLog.create({
        data: {
          origin: isAdCreator ? 'ORDER_PORTAL' : 'AD_MANAGER',
          tradeId: trade.id,
          userAddress: callerUnlockWallet,
          signature: dto.signature,
          reqHash: requestContractDetails.reqHash,
        },
      });

      return {
        ...requestContractDetails,
        chainKind: unlockChain.kind as string,
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

  async confirmChainAction(
    req: Request,
    tradeId: string,
    dto: ConfirmTradeActionDto,
  ) {
    try {
      const reqUser = req.user;

      if (!reqUser) throw new ForbiddenException('Unauthorized');

      const tradeLogUpdate = await this.prisma.tradeUpdateLog.findUnique({
        where: { tradeId: tradeId, signature: dto.signature },
        include: { trade: true, log: true },
      });

      if (!tradeLogUpdate)
        throw new NotFoundException('Trade update log not found');

      const callerLinked = await this.users.getLinkedAddresses(reqUser.sub);
      const isParticipant =
        callerLinked.has(
          normalizeChainAddress(tradeLogUpdate.trade.bridgerAddress),
        ) ||
        callerLinked.has(
          normalizeChainAddress(tradeLogUpdate.trade.adCreatorAddress),
        );
      if (!isParticipant) {
        throw new ForbiddenException('Unauthorized');
      }

      // get ad details
      const trade = await this.prisma.trade.findUnique({
        where: { id: tradeId },
        select: {
          route: {
            select: {
              adToken: {
                select: {
                  chain: {
                    select: {
                      adManagerAddress: true,
                      chainId: true,
                      mmrId: true,
                      kind: true,
                    },
                  },
                },
              },
              orderToken: {
                select: {
                  chain: {
                    select: {
                      orderPortalAddress: true,
                      chainId: true,
                      mmrId: true,
                      kind: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!trade) throw new NotFoundException('Ad for Ad Id not found');

      if (tradeLogUpdate.origin === 'AD_MANAGER') {
        // verify adLog
        const isValidated = await this.chainAdapters
          .forChain(trade.route.adToken.chain.kind)
          .validateAdManagerRequest({
            chainId: trade.route.adToken.chain.chainId,
            contractAddress: trade.route.adToken.chain
              .adManagerAddress as `0x${string}`,
            reqHash: tradeLogUpdate.reqHash as `0x${string}`,
          });

        if (!isValidated) {
          throw new BadRequestException('AdManager request not validated');
        }
      } else {
        // verify orderPortal
        const isValidated = await this.chainAdapters
          .forChain(trade.route.orderToken.chain.kind)
          .validateOrderPortalRequest({
            chainId: trade.route.orderToken.chain.chainId,
            contractAddress: trade.route.orderToken.chain
              .orderPortalAddress as `0x${string}`,
            reqHash: tradeLogUpdate.reqHash as `0x${string}`,
          });

        if (!isValidated) {
          throw new BadRequestException('OrderPortal request not validated');
        }
      }

      if (tradeLogUpdate.ctx == 'LOCKORDER') {
        await this.merkleService.append(
          trade.route.adToken.chain.mmrId,
          tradeLogUpdate.trade.orderHash,
        );
      } else if (tradeLogUpdate.ctx == 'CREATEORDER') {
        await this.merkleService.append(
          trade.route.orderToken.chain.mmrId,
          tradeLogUpdate.trade.orderHash,
        );
      }

      let status: TradeStatus | undefined = undefined;
      let adLockAuthorized: boolean | undefined = undefined;

      tradeLogUpdate.log.forEach((entry) => {
        if (entry.field === 'Status') {
          status = entry.newValue as TradeStatus;
        } else if (entry.field === 'AdLock') {
          adLockAuthorized = entry.newValue === 'true';
        }
      });

      await this.prisma.trade.update({
        where: { id: tradeLogUpdate.tradeId },
        data: {
          status,
          adLock: adLockAuthorized
            ? { update: { authorized: adLockAuthorized } }
            : undefined,
        },
      });

      // delete the log entry
      await this.prisma.tradeUpdateLog.delete({
        where: { id: tradeLogUpdate.id },
      });

      // On LOCKED  tell the bridger they can now unlock on the ad chain.
      if (status === 'LOCKED') {
        await this.notifications.safeCreateForAddress(
          tradeLogUpdate.trade.bridgerAddress,
          {
            type: 'TRADE_LOCKED',
            tradeId: tradeLogUpdate.tradeId,
            title: 'Your order is locked — claim now',
            body: 'The ad creator locked funds for your order. You can unlock your tokens on the ad chain.',
          },
          trade.route.orderToken.chain.kind,
        );
      }

      return {
        tradeId,
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

  async confirmUnlockChainAction(
    req: Request,
    tradeId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _dto: ConfirmTradeActionDto,
  ) {
    try {
      const reqUser = req.user;

      if (!reqUser) throw new ForbiddenException('Unauthorized');

      const callerLinked = await this.users.getLinkedAddresses(reqUser.sub);

      const authorizationLog = await this.prisma.authorizationLog.findFirst({
        where: {
          tradeId: tradeId,
          userAddress: { in: Array.from(callerLinked) },
        },
        orderBy: { createdAt: 'desc' },
        include: { trade: true },
      });

      if (!authorizationLog)
        throw new NotFoundException('Authorization log not found');

      const isParticipant =
        callerLinked.has(
          normalizeChainAddress(authorizationLog.trade.bridgerAddress),
        ) ||
        callerLinked.has(
          normalizeChainAddress(authorizationLog.trade.adCreatorAddress),
        );
      if (!isParticipant) {
        throw new ForbiddenException('Unauthorized');
      }

      // get ad details
      const trade = await this.prisma.trade.findUnique({
        where: { id: tradeId },
        select: {
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
              orderToken: {
                select: {
                  chain: {
                    select: {
                      orderPortalAddress: true,
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

      if (!trade) throw new NotFoundException('Ad for Ad Id not found');

      if (authorizationLog.origin === 'AD_MANAGER') {
        // verify log
        const isValidated = await this.chainAdapters
          .forChain(trade.route.adToken.chain.kind)
          .validateAdManagerRequest({
            chainId: trade.route.adToken.chain.chainId,
            contractAddress: trade.route.adToken.chain
              .adManagerAddress as `0x${string}`,
            reqHash: authorizationLog.reqHash as `0x${string}`,
          });

        if (!isValidated) {
          throw new BadRequestException('AdManager request not validated');
        }
      } else {
        // verify log
        const isValidated = await this.chainAdapters
          .forChain(trade.route.orderToken.chain.kind)
          .validateOrderPortalRequest({
            chainId: trade.route.orderToken.chain.chainId,
            contractAddress: trade.route.orderToken.chain
              .orderPortalAddress as `0x${string}`,
            reqHash: authorizationLog.reqHash as `0x${string}`,
          });

        if (!isValidated) {
          throw new BadRequestException('OrderPortal request not validated');
        }
      }

      const isAdCreator = callerLinked.has(
        normalizeChainAddress(authorizationLog.trade.adCreatorAddress),
      );

      const updatedTrade = await this.prisma.trade.update({
        where: { id: authorizationLog.tradeId },
        data: {
          adCreatorClaimed: isAdCreator
            ? (true as boolean)
            : authorizationLog.trade.adCreatorClaimed,
          bridgerClaimed: !isAdCreator
            ? (true as boolean)
            : authorizationLog.trade.bridgerClaimed,
          status:
            (isAdCreator && authorizationLog.trade.bridgerClaimed) ||
            (!isAdCreator && authorizationLog.trade.adCreatorClaimed)
              ? ('COMPLETED' as const)
              : undefined,
        },
      });

      // delete the log entry
      await this.prisma.authorizationLog.delete({
        where: { id: authorizationLog.id },
      });

      // process message for unlocks
      if (
        !isAdCreator &&
        !authorizationLog.trade.bridgerClaimed &&
        !authorizationLog.trade.adCreatorClaimed
      ) {
        await this.notifications.safeCreateForAddress(
          authorizationLog.trade.adCreatorAddress,
          {
            type: 'BRIDGER_CLAIMED',
            tradeId: authorizationLog.tradeId,
            title: 'Bridger claimed — your turn',
            body: 'The bridger unlocked their tokens. You can now unlock yours on the order chain.',
          },
          trade.route.adToken.chain.kind,
        );
      }

      return {
        tradeId: updatedTrade.id,
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
