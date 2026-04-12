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
import { getAddress, isAddress } from 'viem';
import { Request, Response } from 'express';
import { ViemService } from '../../providers/viem/viem.service';
import { MMRService } from '../mmr/mmr.service';
import { ProofService } from '../../providers/noir/proof.service';
import { randomUUID } from 'crypto';
import { Prisma, TradeStatus } from '@prisma/client';
import { EncryptionService } from '@libs/encryption.service';
import { toBytes32, uuidToBigInt } from '../../providers/viem/ethers/typedData';

@Injectable()
export class TradesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly viemService: ViemService,
    private readonly merkleService: MMRService,
    private readonly proofService: ProofService,
    private readonly encryptionService: EncryptionService,
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
                  chain: { select: { name: true, chainId: true } },
                  kind: true,
                  address: true,
                  decimals: true,
                },
              },
              orderToken: {
                select: {
                  id: true,
                  symbol: true,
                  chain: { select: { name: true, chainId: true } },
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
      if (q.adCreatorAddress)
        where.adCreatorAddress = getAddress(q.adCreatorAddress);
      if (q.bridgerAddress) where.bridgerAddress = getAddress(q.bridgerAddress);

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
                  chain: { select: { name: true, chainId: true } },
                  kind: true,
                  address: true,
                  decimals: true,
                },
              },
              orderToken: {
                select: {
                  id: true,
                  symbol: true,
                  chain: { select: { name: true, chainId: true } },
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

      const user = await this.prisma.user.findUnique({
        where: { id: reqUser.sub },
      });

      if (!user) throw new UnauthorizedException('Unauthorized');

      if (!isAddress(dto.bridgerDstAddress)) {
        throw new BadRequestException('Invalid address');
      }

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
                    chain: {
                      select: {
                        orderPortalAddress: true,
                        chainId: true,
                        mmrId: true,
                      },
                    },
                  },
                },
                adToken: {
                  select: {
                    address: true,
                    chain: {
                      select: {
                        adManagerAddress: true,
                        chainId: true,
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

      if (ad.creatorAddress.toLowerCase() == user.walletAddress.toLowerCase()) {
        throw new BadRequestException(
          'Ad creator cannot create trade on own ad',
        );
      }

      const amount = new Prisma.Decimal(dto.amount);
      if (ad.minAmount && amount.lt(ad.minAmount)) {
        throw new BadRequestException('Amount below minAmount');
      }
      if (ad.maxAmount && amount.gt(ad.maxAmount)) {
        throw new BadRequestException('Amount above maxAmount');
      }

      // available = pool - sum(locks not released)
      const lockSum = await this.prisma.adLock.aggregate({
        where: { adId: ad.id, releasedAt: null },
        _sum: { amount: true },
      });
      const locked = lockSum._sum.amount ?? new Prisma.Decimal(0);
      const available = ad.poolAmount.sub(locked);
      if (amount.gt(available))
        throw new BadRequestException('Insufficient liquidity');

      const secret = this.proofService.generateSecret();
      const tradeId = randomUUID();

      const reqContractDetails =
        await this.viemService.getCreateOrderRequestContractDetails({
          orderChainId: ad.route.orderToken.chain.chainId,
          orderContractAddress: ad.route.orderToken.chain
            .orderPortalAddress as `0x${string}`,
          orderParams: {
            orderChainToken: toBytes32(ad.route.orderToken.address),
            adChainToken: toBytes32(ad.route.adToken.address),
            amount: amount.toFixed(0),
            bridger: toBytes32(user.walletAddress),
            orderChainId: ad.route.orderToken.chain.chainId.toString(),
            orderPortal: toBytes32(
              ad.route.orderToken.chain.orderPortalAddress,
            ),
            orderRecipient: toBytes32(dto.bridgerDstAddress),
            adChainId: ad.route.adToken.chain.chainId.toString(),
            adManager: toBytes32(ad.route.adToken.chain.adManagerAddress),
            adId: ad.id,
            adCreator: toBytes32(ad.creatorAddress),
            adRecipient: toBytes32(ad.creatorDstAddress),
            salt: tradeId,
          },
        });

      // Persist in a single transaction: then AdLock
      const result = await this.prisma.$transaction(async (tx) => {
        const trade = await tx.trade.create({
          data: {
            id: tradeId,
            adId: ad.id,
            routeId: ad.route.id,
            amount: amount.toFixed(0),
            adCreatorAddress: getAddress(ad.creatorAddress),
            adCreatorDstAddress: getAddress(ad.creatorDstAddress),
            bridgerAddress: getAddress(user.walletAddress),
            bridgerDstAddress: getAddress(dto.bridgerDstAddress),
            orderHash: reqContractDetails.orderHash,
          },
          select: { id: true, status: true },
        });

        await tx.adLock.create({
          data: { adId: ad.id, tradeId: trade.id, amount: amount },
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

      return result;
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

      const user = await this.prisma.user.findUnique({
        where: { id: reqUser.sub },
      });

      if (!user) throw new UnauthorizedException('Unauthorized');

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
                  chain: {
                    select: {
                      chainId: true,
                      adManagerAddress: true,
                      mmrId: true,
                    },
                  },
                },
              },
              orderToken: {
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

      if (
        getAddress(trade.bridgerAddress) !== getAddress(user.walletAddress) &&
        getAddress(trade.adCreatorAddress) !== getAddress(user.walletAddress)
      ) {
        throw new ForbiddenException('Unauthorized');
      }

      return {
        orderChainToken: getAddress(trade.route.orderToken.address),
        adChainToken: getAddress(trade.route.adToken.address),
        amount: trade.amount.toFixed(0),
        bridger: getAddress(trade.bridgerAddress),
        orderChainId: trade.route.orderToken.chain.chainId.toString(),
        orderPortal: getAddress(
          trade.route.orderToken.chain.orderPortalAddress,
        ),
        orderRecipient: getAddress(trade.bridgerDstAddress),
        adChainId: trade.route.adToken.chain.chainId.toString(),
        adManager: getAddress(trade.route.adToken.chain.adManagerAddress),
        adId: trade.adId,
        adCreator: getAddress(trade.adCreatorAddress),
        adRecipient: getAddress(trade.adCreatorDstAddress),
        salt: uuidToBigInt(trade.id).toString(),
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

      const user = await this.prisma.user.findUnique({
        where: { id: reqUser.sub },
      });

      if (!user) throw new UnauthorizedException('Unauthorized');

      const trade = await this.prisma.trade.findFirst({
        where: {
          id: tradeId,
          adCreatorAddress: getAddress(user.walletAddress),
        },
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
                  chain: {
                    select: {
                      chainId: true,
                      adManagerAddress: true,
                      mmrId: true,
                    },
                  },
                },
              },
              orderToken: {
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
        throw new BadRequestException('Trade is already locked');
      }

      if (trade.adLock && !trade.adLock.amount.eq(trade.amount)) {
        throw new BadRequestException('AdLock amount mismatch');
      }

      const reqContractDetails =
        await this.viemService.getLockForOrderRequestContractDetails({
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

  async unlock(req: Request, id: string, dto: UnlockTradeDto) {
    try {
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
                  chain: {
                    select: {
                      adManagerAddress: true,
                      chainId: true,
                      mmrId: true,
                    },
                  },
                },
              },
              orderToken: {
                select: {
                  address: true,
                  chain: {
                    select: {
                      orderPortalAddress: true,
                      chainId: true,
                      mmrId: true,
                    },
                  },
                },
              },
            },
          },
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

      const isAuthorized = this.viemService.verifyOrderSignature(
        caller,
        trade.orderHash as `0x${string}`,
        dto.signature as `0x${string}`,
      );

      if (!isAuthorized) {
        throw new BadRequestException('Invalid User Signature');
      }

      const isAdCreator = caller === getAddress(trade.adCreatorAddress);

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

      const rootExists = await this.viemService.checkLocalRootExist(
        localRoot,
        isAdCreator,
        {
          chainId: isAdCreator
            ? trade.route.orderToken.chain.chainId
            : trade.route.adToken.chain.chainId,
          contractAddress: isAdCreator
            ? (trade.route.orderToken.chain.orderPortalAddress as `0x${string}`)
            : (trade.route.adToken.chain.adManagerAddress as `0x${string}`),
        },
      );

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

      const requestContractDetails =
        await this.viemService.getUnlockOrderContractDetails({
          chainId: isAdCreator
            ? trade.route.orderToken.chain.chainId
            : trade.route.adToken.chain.chainId,
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
          },
          nullifierHash: nullifierHash,
          targetRoot: localRoot,
          proof,
        });

      // create authorization log for tracking
      await this.prisma.authorizationLog.create({
        data: {
          origin: isAdCreator ? 'ORDER_PORTAL' : 'AD_MANAGER',
          tradeId: trade.id,
          userAddress: caller,
          signature: dto.signature,
          reqHash: requestContractDetails.reqHash,
        },
      });

      return requestContractDetails;
    } catch (e) {
      console.log(e);
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

      const user = await this.prisma.user.findUnique({
        where: { id: reqUser.sub },
      });

      if (!user) throw new ForbiddenException('Unauthorized');

      const tradeLogUpdate = await this.prisma.tradeUpdateLog.findUnique({
        where: { tradeId: tradeId, signature: dto.signature },
        include: { trade: true, log: true },
      });

      if (!tradeLogUpdate)
        throw new NotFoundException('Trade update log not found');

      if (
        getAddress(tradeLogUpdate.trade.bridgerAddress) !==
          getAddress(user.walletAddress) &&
        getAddress(tradeLogUpdate.trade.adCreatorAddress) !==
          getAddress(user.walletAddress)
      ) {
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
        const isValidated = await this.viemService.validateAdManagerRequest({
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
        const isValidated = await this.viemService.validateOrderPortalRequest({
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
    dto: ConfirmTradeActionDto,
  ) {
    try {
      const reqUser = req.user;

      if (!reqUser) throw new ForbiddenException('Unauthorized');

      const user = await this.prisma.user.findUnique({
        where: { id: reqUser.sub },
      });

      if (!user) throw new ForbiddenException('Unauthorized');

      const authorizationLog = await this.prisma.authorizationLog.findFirst({
        where: {
          tradeId: tradeId,
          userAddress: getAddress(user.walletAddress),
        },
        orderBy: { createdAt: 'desc' },
        include: { trade: true },
      });

      if (!authorizationLog)
        throw new NotFoundException('Authorization log not found');

      if (
        getAddress(authorizationLog.trade.bridgerAddress) !==
          getAddress(user.walletAddress) &&
        getAddress(authorizationLog.trade.adCreatorAddress) !==
          getAddress(user.walletAddress)
      ) {
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
        const isValidated = await this.viemService.validateAdManagerRequest({
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
        const isValidated = await this.viemService.validateOrderPortalRequest({
          chainId: trade.route.orderToken.chain.chainId,
          contractAddress: trade.route.orderToken.chain
            .orderPortalAddress as `0x${string}`,
          reqHash: authorizationLog.reqHash as `0x${string}`,
        });

        if (!isValidated) {
          throw new BadRequestException('OrderPortal request not validated');
        }
      }

      const caller = getAddress(user.walletAddress);

      const isAdCreator =
        caller === getAddress(authorizationLog.trade.adCreatorAddress);

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

      console.log(dto);

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
