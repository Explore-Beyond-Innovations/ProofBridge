import {
  Injectable,
  ConflictException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import {
  CreateChainDto,
  UpdateChainDto,
  QueryChainsDto,
} from './dto/chain.dto';
import { PublicChain } from '../../types';
import { Chain } from '@prisma/client';

@Injectable()
export class ChainService {
  constructor(private readonly prisma: PrismaService) {}

  async listChainsPublic(query: QueryChainsDto) {
    try {
      const data = await this.listChains(query);
      const rows = data.rows.map((c) => this.toPublic(c));
      return { rows, nextCursor: data.nextCursor };
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

  async listChains(query: QueryChainsDto) {
    try {
      const take = query.limit ?? 25;
      const cursor = query.cursor ? { id: query.cursor } : undefined;

      const where: {
        name?: { contains: string; mode: 'insensitive' };
        chainId?: bigint;
      } = {};

      if (query.name) {
        where.name = { contains: query.name, mode: 'insensitive' };
      }
      if (query.chainId) {
        where.chainId = BigInt(query.chainId);
      }

      const rows = await this.prisma.chain.findMany({
        where,
        orderBy: { id: 'asc' },
        take: take + 1,
        ...(cursor ? { cursor, skip: 1 } : {}),
        select: {
          id: true,
          name: true,
          chainId: true,
          kind: true,
          mmrId: true,
          adManagerAddress: true,
          orderPortalAddress: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      let nextCursor: string | null = null;
      if (rows.length > take) {
        const next = rows.pop()!;
        nextCursor = next.id;
      }

      return { rows, nextCursor };
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

  async getByChainId(chainId: string) {
    try {
      const chain = await this.prisma.chain.findUnique({
        where: { chainId: BigInt(chainId) },
        select: {
          id: true,
          name: true,
          mmrId: true,
          chainId: true,
          kind: true,
          adManagerAddress: true,
          orderPortalAddress: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!chain) throw new NotFoundException('Chain not found');

      return this.toPublic(chain);
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

  async create(dto: CreateChainDto) {
    try {
      const created = await this.prisma.chain.create({
        data: {
          name: dto.name,
          chainId: BigInt(dto.chainId),
          adManagerAddress: dto.adManagerAddress,
          orderPortalAddress: dto.orderPortalAddress,
          ...(dto.kind ? { kind: dto.kind } : {}),
          mmr: {
            create: {
              chainId: dto.chainId,
            },
          },
        },
        select: {
          id: true,
          name: true,
          chainId: true,
          kind: true,
          adManagerAddress: true,
          orderPortalAddress: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const response = {
        ...created,
        chainId: created.chainId.toString(),
      };

      return response;
    } catch (e: any) {
      if (e?.code === 'P2002')
        throw new ConflictException('Chain already exists');
      throw e;
    }
  }

  async update(id: string, dto: UpdateChainDto) {
    await this.ensureExists(id);

    try {
      const updated = await this.prisma.chain.update({
        where: { id },
        data: {
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.chainId ? { chainId: BigInt(dto.chainId) } : {}),
          ...(dto.kind ? { kind: dto.kind } : {}),
          ...(dto.adManagerAddress
            ? { adManagerAddress: dto.adManagerAddress }
            : {}),
          ...(dto.orderPortalAddress
            ? { orderPortalAddress: dto.orderPortalAddress }
            : {}),
        },
        select: {
          id: true,
          name: true,
          chainId: true,
          kind: true,
          adManagerAddress: true,
          orderPortalAddress: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const response = {
        ...updated,
        chainId: updated.chainId.toString(),
      };
      return response;
    } catch (e: any) {
      if (e?.code === 'P2002')
        throw new ConflictException('Chain already exists');
      throw e;
    }
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.chain.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.chain.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Chain not found');
  }

  private toPublic(c: Chain): PublicChain {
    return {
      name: c.name,
      chainId: c.chainId.toString(),
      kind: c.kind,
      adManagerAddress: c.adManagerAddress,
      orderPortalAddress: c.orderPortalAddress,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}
