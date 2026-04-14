import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import {
  CreateTokenDto,
  QueryTokensDto,
  UpdateTokenDto,
} from './dto/token.dto';
import { TokenRow } from '../../types';
import { getAddress } from 'ethers';
import { StrKey } from '@stellar/stellar-sdk';

/**
 * `assetIssuer` is only meaningful for SAC tokens, which wrap a classic
 * Stellar asset. Enforce both presence (for SAC) and absence (for the other
 * kinds) at the service boundary so data stays consistent.
 */
function validateAssetIssuer(
  kind: string | undefined,
  assetIssuer: string | undefined,
): void {
  if (kind === 'SAC') {
    if (!assetIssuer) {
      throw new BadRequestException(
        'assetIssuer is required for SAC tokens (classic-asset issuer G-strkey)',
      );
    }
    if (!StrKey.isValidEd25519PublicKey(assetIssuer)) {
      throw new BadRequestException(
        'assetIssuer must be a valid Stellar G-strkey',
      );
    }
    return;
  }
  if (assetIssuer) {
    throw new BadRequestException(
      'assetIssuer is only allowed for SAC tokens',
    );
  }
}

@Injectable()
export class TokenService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryTokensDto) {
    try {
      const take = query.limit ?? 100;
      const cursor = query.cursor ? { id: query.cursor } : undefined;
      const where: {
        name?: { contains: string; mode: 'insensitive' };
        chainUid?: string;
        symbol?: { contains: string; mode: 'insensitive' };
        address?:
          | { contains: string; mode: 'insensitive' }
          | { equals: string };
      } = {};

      if (query.chainUid) {
        where.chainUid = query.chainUid;
      }

      if (query.chainId) {
        const chain = await this.prisma.chain.findFirst({
          where: { chainId: BigInt(query.chainId) },
          select: { id: true },
        });
        if (chain) {
          where.chainUid = chain.id;
        }
      }

      if (query.symbol) {
        where.symbol = { contains: query.symbol, mode: 'insensitive' };
      }
      if (query.address) {
        where.address = { equals: query.address.toLowerCase() };
      }

      const rows = await this.prisma.token.findMany({
        where,
        orderBy: { id: 'asc' },
        take: take + 1,
        ...(cursor ? { cursor, skip: 1 } : {}),
        select: {
          id: true,
          symbol: true,
          name: true,
          address: true,
          decimals: true,
          kind: true,
          assetIssuer: true,
          createdAt: true,
          updatedAt: true,
          chain: { select: { id: true, name: true, chainId: true, kind: true } },
        },
      });

      let nextCursor: string | null = null;
      if (rows.length > take) {
        const next = rows.pop()!;
        nextCursor = next.id;
      }

      return { data: rows.map((c) => this.serialize(c)), nextCursor };
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
      const row = await this.prisma.token.findUnique({
        where: { id },
        select: {
          id: true,
          symbol: true,
          name: true,
          address: true,
          decimals: true,
          kind: true,
          assetIssuer: true,
          createdAt: true,
          updatedAt: true,
          chain: { select: { id: true, name: true, chainId: true, kind: true } },
        },
      });
      if (!row) throw new NotFoundException('Token not found');
      return this.serialize(row as TokenRow);
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

  async create(dto: CreateTokenDto) {
    validateAssetIssuer(dto.kind, dto.assetIssuer);
    try {
      const created = await this.prisma.token.create({
        data: {
          chainUid: dto.chainUid,
          symbol: dto.symbol,
          name: dto.name,
          address: dto.address.toLowerCase(),
          decimals: dto.decimals,
          kind: dto.kind,
          assetIssuer: dto.assetIssuer,
        },
        select: {
          id: true,
          symbol: true,
          name: true,
          address: true,
          decimals: true,
          kind: true,
          assetIssuer: true,
          createdAt: true,
          updatedAt: true,
          chain: { select: { id: true, name: true, chainId: true, kind: true } },
        },
      });
      return this.serialize(created);
    } catch (e: any) {
      if (e?.code === 'P2003') {
        throw new NotFoundException('Chain not found');
      }
      if (e?.code === 'P2002') {
        throw new ConflictException('Token already exists for this chain');
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateTokenDto) {
    const exists = await this.prisma.token.findUnique({
      where: { id },
      select: { id: true, kind: true },
    });
    if (!exists) throw new NotFoundException('Token not found');

    // Compute the post-update kind so we validate against the row's final
    // state, not just what the DTO partially carries.
    const nextKind = dto.kind ?? exists.kind;
    if (dto.assetIssuer !== undefined) {
      validateAssetIssuer(
        nextKind,
        dto.assetIssuer === '' ? undefined : dto.assetIssuer,
      );
    } else if (dto.kind && dto.kind !== exists.kind) {
      // Kind is changing without touching assetIssuer. Only SAC rows carry an
      // issuer, so require explicit clearing when moving SAC → non-SAC.
      if (exists.kind === 'SAC' && dto.kind !== 'SAC') {
        throw new BadRequestException(
          'Changing kind away from SAC requires clearing assetIssuer (pass an empty string)',
        );
      }
    }

    try {
      const updated = await this.prisma.token.update({
        where: { id },
        data: {
          ...(dto.chainUid ? { chainUid: dto.chainUid } : {}),
          ...(dto.symbol ? { symbol: dto.symbol } : {}),
          ...(dto.name ? { name: dto.name } : {}),
          ...(dto.address ? { address: dto.address.toLowerCase() } : {}),
          ...(dto.decimals !== undefined ? { decimals: dto.decimals } : {}),
          ...(dto.kind ? { kind: dto.kind } : {}),
          ...(dto.assetIssuer !== undefined
            ? { assetIssuer: dto.assetIssuer === '' ? null : dto.assetIssuer }
            : {}),
        },
        select: {
          id: true,
          symbol: true,
          name: true,
          address: true,
          decimals: true,
          kind: true,
          assetIssuer: true,
          createdAt: true,
          updatedAt: true,
          chain: { select: { id: true, name: true, chainId: true, kind: true } },
        },
      });
      return this.serialize(updated);
    } catch (e: any) {
      if (e?.code === 'P2003') throw new NotFoundException('Chain not found');
      if (e?.code === 'P2002')
        throw new ConflictException('Token already exists for this chain');
      throw e;
    }
  }

  async remove(id: string) {
    const exists = await this.prisma.token.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Token not found');
    await this.prisma.token.delete({ where: { id } });
  }

  private serialize(row: TokenRow) {
    return {
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      address:
        row.chain.kind === 'EVM' ? getAddress(row.address) : row.address,
      decimals: row.decimals,
      kind: row.kind,
      assetIssuer: row.assetIssuer,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      chain: {
        id: row.chain.id,
        name: row.chain.name,
        chainId: row.chain.chainId.toString(),
        kind: row.chain.kind,
      },
    };
  }
}
