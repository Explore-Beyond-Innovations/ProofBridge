/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import {
  ConfirmChainActionDto,
  ConfirmTradeDto,
  CreateTradeDto,
  QueryTradesDto,
} from './dto/trade.dto';
import { getAddress, isAddress } from 'ethers';
import { Request } from 'express';
import { Prisma } from '@prisma/client';

function toBI(s: string) {
  return BigInt(s);
}
function sameSymbol(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

@Injectable()
export class TradesService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
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
        participantSignatures: true,
        createdAt: true,
        updatedAt: true,
        ad: {
          select: { id: true, creatorAddress: true, routeId: true },
        },
        route: {
          select: {
            id: true,
            fromToken: {
              select: {
                id: true,
                symbol: true,
                chain: { select: { name: true } },
              },
            },
            toToken: {
              select: {
                id: true,
                symbol: true,
                chain: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Trade not found');

    return row;
  }

  async list(q: QueryTradesDto) {
    const take = q.limit && q.limit > 0 && q.limit <= 100 ? q.limit : 25;
    const cursor = q.cursor ? { id: q.cursor } : undefined;

    const where: {
      routeId?: string;
      adId?: string;
      adCreatorAddress?: string;
      bridgerAddress?: string;
      route?: { fromTokenId?: string; toTokenId?: string };
      amount?: { gte?: string; lte?: string };
    } = {};

    if (q.routeId) where.routeId = q.routeId;
    if (q.adId) where.adId = q.adId;
    if (q.adCreatorAddress) where.adCreatorAddress = q.adCreatorAddress;
    if (q.bridgerAddress) where.bridgerAddress = q.bridgerAddress;

    if (q.fromTokenId)
      where.route = { ...(where.route ?? {}), fromTokenId: q.fromTokenId };
    if (q.toTokenId)
      where.route = { ...(where.route ?? {}), toTokenId: q.toTokenId };

    if (q.minAmount)
      where.amount = { ...(where.amount ?? {}), gte: q.minAmount };
    if (q.maxAmount)
      where.amount = { ...(where.amount ?? {}), lte: q.maxAmount };

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
            fromToken: {
              select: {
                id: true,
                symbol: true,
                chain: { select: { name: true } },
              },
            },
            toToken: {
              select: {
                id: true,
                symbol: true,
                chain: { select: { name: true } },
              },
            },
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    let nextCursor: string | null = null;
    if (rows.length > take) {
      const next = rows.pop()!;
      nextCursor = next.id;
    }

    return { data: rows, nextCursor };
  }

  // creates a new trade along with ad lock
  async create(req: Request, dto: CreateTradeDto) {
    const reqUser = req.user;
    const idemKey = req.headers['idempotency-key'] as string | undefined;

    if (!reqUser) throw new UnauthorizedException('Not authenticated');

    if (!idemKey) throw new BadRequestException('Missing Idempotency-Key');

    const user = await this.prisma.user.findUnique({
      where: { id: reqUser.sub },
    });

    if (!user) throw new UnauthorizedException('Unauthorized');

    if (!isAddress(dto.bridgerDstAddress)) {
      throw new BadRequestException('Invalid address');
    }

    const route = await this.prisma.route.findUnique({
      where: { id: dto.routeId },
      select: {
        id: true,
        fromToken: {
          select: {
            id: true,
            symbol: true,
            address: true,
            decimals: true,
            chain: {
              select: {
                id: true,
                chainId: true,
                name: true,
                adManagerAddress: true,
              },
            },
          },
        },
        toToken: {
          select: {
            id: true,
            symbol: true,
            address: true,
            decimals: true,
            chain: {
              select: {
                id: true,
                chainId: true,
                name: true,
                orderPortalAddress: true,
              },
            },
          },
        },
      },
    });
    if (!route) throw new NotFoundException('Route not found');

    const from = route.fromToken;
    const to = route.toToken;

    if (!sameSymbol(from.symbol, to.symbol)) {
      throw new BadRequestException('Route must be same-symbol on both sides');
    }

    if (from.chain.chainId === to.chain.chainId) {
      throw new BadRequestException('Route must be cross-chain');
    }

    // Ad must exist and belong to adCreatorAddress and same route
    const ad = await this.prisma.ad
      .findUnique({
        where: { id: dto.adId },
        select: {
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

    if (!ad || ad.routeId !== route.id) {
      throw new NotFoundException('Ad not found for route');
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

    const amount = toBI(dto.amount);
    if (ad.minAmount && amount < ad.minAmount) {
      throw new BadRequestException('Amount below minAmount');
    }
    if (ad.maxAmount && amount > ad.maxAmount) {
      throw new BadRequestException('Amount above maxAmount');
    }

    // available = pool - sum(locks not released)
    const lockSum = await this.prisma.adLock.aggregate({
      where: { adId: ad.id, releasedAt: null },
      _sum: { amount: true },
    });
    const locked = lockSum._sum.amount ?? 0n;
    const available = ad.poolAmount - locked;
    if (amount > available)
      throw new BadRequestException('Insufficient liquidity');

    // return same trade if payload matches, else 409
    const existing = await this.prisma.trade.findUnique({
      where: { idempotencyKey: idemKey },
      select: {
        id: true,
        routeId: true,
        adId: true,
        amount: true,
        bridgerAddress: true,
        bridgerDstAddress: true,
        adCreatorAddress: true,
      },
    });

    if (existing) {
      const same =
        existing.routeId === route.id &&
        existing.adId === ad.id &&
        existing.amount.toString() === amount.toString() &&
        getAddress(existing.bridgerDstAddress) ===
          getAddress(dto.bridgerDstAddress);

      if (!same)
        throw new ConflictException(
          'Idempotency-Key reused with different payload',
        );

      const full = await this.getById(existing.id);

      return { trade: full, idempotentHit: true as const };
    }

    // Persist in a single transaction: then AdLock
    const result = await this.prisma.$transaction(async (tx) => {
      const trade = await tx.trade.create({
        data: {
          idempotencyKey: idemKey,
          routeId: route.id,
          adId: ad.id,
          amount: amount.toString(),
          adCreatorAddress: getAddress(ad.creatorAddress),
          adCreatorDstAddress: getAddress(ad.creatorDstAddress),
          bridgerAddress: getAddress(user.walletAddress),
          bridgerDstAddress: getAddress(dto.bridgerDstAddress),
          status: 'INACTIVE',
        },
        select: { id: true, status: true },
      });

      await tx.adLock.create({
        data: { adId: ad.id, tradeId: trade.id, amount: amount },
      });

      // create trade update log to make status active
      const logEntry = await tx.tradeUpdateLog.create({
        data: {
          tradeId: trade.id,
          signature: '0x',
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
      return { tradeId: trade.id, logId: logEntry.id };
    });

    return {
      tradeId: result.tradeId,
      logId: result.logId,
      contractAddress: getAddress(to.chain.orderPortalAddress),
      chainId: to.chain.chainId,
      orderChainToken: to.address,
      orderChainId: to.chain.chainId,
      amount: amount.toString(),
      bridger: getAddress(user.walletAddress),
      orderRecipient: getAddress(dto.bridgerDstAddress),
      adChainId: from.chain.chainId,
      adManager: getAddress(from.chain.adManagerAddress),
      adId: ad.id,
      adCreator: getAddress(ad.creatorAddress),
      adRecipient: getAddress(ad.creatorDstAddress),
      salt: idemKey,
    };
  }

  async lockTrade(req: Request, tradeId: string) {
    const reqUser = req.user;
    if (!reqUser) throw new UnauthorizedException('Not authenticated');

    const user = await this.prisma.user.findUnique({
      where: { id: reqUser.sub },
    });

    if (!user) throw new UnauthorizedException('Unauthorized');

    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId, adCreatorAddress: getAddress(user.walletAddress) },
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
        idempotencyKey: true,
        route: {
          select: {
            fromToken: {
              select: {
                address: true,
                chain: {
                  select: {
                    chainId: true,
                    adManagerAddress: true,
                  },
                },
              },
            },
            toToken: {
              select: {
                address: true,
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
      return { authorized: true };
    }

    if (trade.adLock && trade.adLock.amount !== toBI(trade.amount.toString())) {
      throw new BadRequestException('AdLock amount mismatch');
    }

    // create trade update log to make status locked
    const logEntry = await this.prisma.tradeUpdateLog.create({
      data: {
        tradeId: trade.id,
        signature: '0x',
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
      logId: logEntry.id,
      contractAddress: getAddress(trade.route.fromToken.chain.adManagerAddress),
      chainId: trade.route.fromToken.chain.chainId,
      orderChainToken: trade.route.toToken.address,
      adChainToken: trade.route.fromToken.address,
      amount: trade.amount.toString(),
      bridger: trade.bridgerAddress,
      orderChainId: trade.route.toToken.chain.chainId,
      srcOrderPortal: getAddress(trade.route.toToken.chain.orderPortalAddress),
      orderRecipient: trade.bridgerDstAddress,
      adId: trade.adId,
      adCreator: trade.adCreatorAddress,
      adRecipient: trade.adCreatorDstAddress,
      salt: trade.idempotencyKey,
    };
  }

  async confirmChainAction(
    req: Request,
    tradeId: string,
    dto: ConfirmChainActionDto,
  ) {
    const reqUser = req.user;

    if (!reqUser) throw new ForbiddenException('Unauthorized');

    const user = await this.prisma.user.findUnique({
      where: { id: reqUser.sub },
    });

    if (!user) throw new ForbiddenException('Unauthorized');

    const tradeLogUpdate = await this.prisma.tradeUpdateLog.findUnique({
      where: { id: dto.logId, tradeId, signature: dto.signature },
      include: { trade: true, log: true },
    });

    if (!tradeLogUpdate) throw new NotFoundException('Ad update log not found');

    if (
      tradeLogUpdate.trade.bridgerAddress !== user.walletAddress &&
      tradeLogUpdate.trade.adCreatorAddress !== user.walletAddress
    ) {
      throw new ForbiddenException('Unauthorized');
    }

    // apply the updates
    const data: any = {};

    tradeLogUpdate.log.forEach((entry) => {
      if (entry.field === 'Status') {
        data.status = entry.newValue;
      } else if (entry.field === 'AdLock') {
        data.adLock = { authorized: entry.newValue === 'true' };
      }
    });

    await this.prisma.trade.update({
      where: { id: tradeLogUpdate.tradeId },
      data,
    });

    // delete the log entry
    await this.prisma.tradeUpdateLog.delete({
      where: { id: tradeLogUpdate.id },
    });

    return {
      success: true,
    };
  }

  async authorize(req: Request, id: string, dto: ConfirmTradeDto) {
    const reqUser = req.user;
    if (!reqUser) throw new UnauthorizedException('Not authenticated');

    const user = await this.prisma.user.findUnique({
      where: { id: reqUser.sub },
    });

    if (!user) throw new UnauthorizedException('Unauthorized');

    const trade = await this.prisma.trade.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        bridgerAddress: true,
        adCreatorAddress: true,
        participantSignatures: true,
      },
    });

    if (!trade) throw new NotFoundException('Trade not found');

    const caller = getAddress(user.walletAddress);

    const isParty =
      caller === getAddress(trade.bridgerAddress) ||
      caller === getAddress(trade.adCreatorAddress);

    if (!isParty) throw new UnauthorizedException('Not a participant');

    // ensure that trade status is locked
    if (trade.status !== 'LOCKED') {
      throw new BadRequestException(
        `Trade status must be LOCKED to confirm, got ${trade.status}`,
      );
    }

    // check if caller has already submitted signature
    if (
      trade.participantSignatures &&
      trade.participantSignatures[caller] === dto.encodedSignature
    ) {
      return {
        status: trade.status,
        participantSignatures: trade.participantSignatures,
      };
    }

    // update the signature for caller
    const sigs: Prisma.JsonObject = JSON.parse(
      JSON.stringify(trade.participantSignatures || {}),
    ) as Prisma.JsonObject;

    sigs[caller] = dto.encodedSignature;

    const hasBridgerSig = !!sigs[getAddress(trade.bridgerAddress)];
    const hasCreatorSig = !!sigs[getAddress(trade.adCreatorAddress)];

    const newStatus = hasBridgerSig && hasCreatorSig ? 'AUTH_BOTH' : 'LOCKED';

    const updated = await this.prisma.trade.update({
      where: { id: trade.id },
      data: { participantSignatures: sigs, status: newStatus },
      select: { status: true, participantSignatures: true },
    });

    return {
      status: updated.status,
      participantSignatures: updated.participantSignatures,
    };
  }
}
