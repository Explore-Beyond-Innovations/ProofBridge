import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { CreateRouteDto, QueryRoutesDto } from './dto/route.dto';
import { Prisma } from '@prisma/client';
import { RouteRow } from '../../types';

@Injectable()
export class RoutesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryRoutesDto) {
    try {
      const take = query.limit ?? 25;
      const cursor = query.cursor ? { id: query.cursor } : undefined;

      const where: {
        adTokenId?: string;
        orderTokenId?: string;
        adToken?: {
          chain?: { chainId: bigint };
          symbol?: { equals: string; mode: 'insensitive' };
        };
        orderToken?: {
          chain?: { chainId: bigint };
          symbol?: { equals: string; mode: 'insensitive' };
        };
        OR?: Array<{
          adToken?: { symbol: { equals: string; mode: 'insensitive' } };
          orderToken?: { symbol: { equals: string; mode: 'insensitive' } };
        }>;
      } = {};

      if (query.adTokenId) where.adTokenId = query.adTokenId;
      if (query.orderTokenId) where.orderTokenId = query.orderTokenId;

      if (!query.adTokenId && !query.orderTokenId) {
        const hasChainFilters = query.adChainId && query.orderChainId;
        if (hasChainFilters) {
          where.adToken = {
            chain: { chainId: BigInt(query.adChainId!) },
            ...(query.symbol
              ? { symbol: { equals: query.symbol, mode: 'insensitive' } }
              : {}),
          };
          where.orderToken = {
            chain: { chainId: BigInt(query.orderChainId!) },
            ...(query.symbol
              ? { symbol: { equals: query.symbol, mode: 'insensitive' } }
              : {}),
          };
        } else if (query.symbol) {
          // If only symbol supplied, match either side containing symbol
          where.OR = [
            {
              adToken: {
                symbol: { equals: query.symbol, mode: 'insensitive' },
              },
            },
            {
              orderToken: {
                symbol: { equals: query.symbol, mode: 'insensitive' },
              },
            },
          ];
        }
      }

      const rows = await this.prisma.route.findMany({
        where,
        orderBy: { id: 'asc' },
        take: take + 1,
        ...(cursor ? { cursor, skip: 1 } : {}),
        select: {
          id: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
          adToken: {
            select: {
              id: true,
              symbol: true,
              name: true,
              address: true,
              decimals: true,
              kind: true,
              assetIssuer: true,
              chain: { select: { id: true, name: true, chainId: true, kind: true } },
            },
          },
          orderToken: {
            select: {
              id: true,
              symbol: true,
              name: true,
              address: true,
              decimals: true,
              kind: true,
              assetIssuer: true,
              chain: { select: { id: true, name: true, chainId: true, kind: true } },
            },
          },
        },
      });

      let nextCursor: string | null = null;
      if (rows.length > take) {
        const next = rows.pop()!;
        nextCursor = next.id;
      }

      return { data: rows.map((r) => this.serialize(r)), nextCursor };
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

  async getById(id: string) {
    try {
      const row = await this.prisma.route.findUnique({
        where: { id },
        select: {
          id: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
          adToken: {
            select: {
              id: true,
              symbol: true,
              name: true,
              address: true,
              decimals: true,
              kind: true,
              assetIssuer: true,
              chain: { select: { id: true, name: true, chainId: true, kind: true } },
            },
          },
          orderToken: {
            select: {
              id: true,
              symbol: true,
              name: true,
              address: true,
              decimals: true,
              kind: true,
              assetIssuer: true,
              chain: { select: { id: true, name: true, chainId: true, kind: true } },
            },
          },
        },
      });
      if (!row) throw new NotFoundException('Route not found');
      return this.serialize(row as RouteRow);
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

  async create(dto: CreateRouteDto) {
    if (dto.adTokenId === dto.orderTokenId) {
      throw new BadRequestException('Self-routes are not allowed');
    }

    // Ensure tokens exist
    const [fromExists, toExists] = await Promise.all([
      this.prisma.token.findUnique({
        where: { id: dto.adTokenId },
        select: { id: true },
      }),
      this.prisma.token.findUnique({
        where: { id: dto.orderTokenId },
        select: { id: true },
      }),
    ]);

    if (!fromExists || !toExists) {
      throw new NotFoundException('Token not found');
    }

    const jsonData: Prisma.JsonObject = JSON.parse(
      JSON.stringify(dto.metadata || {}),
    ) as Prisma.JsonObject;

    try {
      const row = await this.prisma.route.create({
        data: {
          adTokenId: dto.adTokenId,
          orderTokenId: dto.orderTokenId,
          metadata: jsonData,
        },
        select: {
          id: true,
          metadata: true,
          createdAt: true,
          updatedAt: true,
          adToken: {
            select: {
              id: true,
              symbol: true,
              name: true,
              address: true,
              decimals: true,
              kind: true,
              assetIssuer: true,
              chain: { select: { id: true, name: true, chainId: true, kind: true } },
            },
          },
          orderToken: {
            select: {
              id: true,
              symbol: true,
              name: true,
              address: true,
              decimals: true,
              kind: true,
              assetIssuer: true,
              chain: { select: { id: true, name: true, chainId: true, kind: true } },
            },
          },
        },
      });
      return this.serialize(row as RouteRow);
    } catch (e: any) {
      // P2002 = unique (adTokenId, orderTokenId)
      if (e?.code === 'P2002')
        throw new ConflictException('Route already exists');
      // P2003 = FK failure
      if (e?.code === 'P2003') throw new NotFoundException('Token not found');
      throw e;
    }
  }

  async remove(id: string) {
    const exists = await this.prisma.route.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Route not found');
    await this.prisma.route.delete({ where: { id } });
  }

  private serialize(row: RouteRow) {
    const payload = row.metadata ? (row.metadata as Prisma.JsonObject) : {};
    return {
      id: row.id,
      metadata: payload,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      adToken: {
        id: row.adToken.id,
        symbol: row.adToken.symbol,
        name: row.adToken.name,
        address: row.adToken.address,
        decimals: row.adToken.decimals,
        kind: row.adToken.kind,
        assetIssuer: row.adToken.assetIssuer,
        chain: {
          id: row.adToken.chain.id,
          name: row.adToken.chain.name,
          chainId: row.adToken.chain.chainId.toString(),
          kind: row.adToken.chain.kind,
        },
      },
      orderToken: {
        id: row.orderToken.id,
        symbol: row.orderToken.symbol,
        name: row.orderToken.name,
        address: row.orderToken.address,
        decimals: row.orderToken.decimals,
        kind: row.orderToken.kind,
        assetIssuer: row.orderToken.assetIssuer,
        chain: {
          id: row.orderToken.chain.id,
          name: row.orderToken.chain.name,
          chainId: row.orderToken.chain.chainId.toString(),
          kind: row.orderToken.chain.kind,
        },
      },
    };
  }
}
