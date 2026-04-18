import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Notification, NotificationType, Prisma } from '@prisma/client';
import { normalizeChainAddress } from '../../providers/viem/ethers/typedData';
import { NotificationGateway } from './notification.gateway';

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  tradeId?: string | null;
  title: string;
  body: string;
  payload?: Prisma.InputJsonValue | null;
}

export interface ListNotificationQuery {
  unreadOnly?: boolean;
  limit?: number;
  cursor?: string | null;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationGateway,
  ) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    const row = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        tradeId: input.tradeId ?? null,
        title: input.title,
        body: input.body,
        payload: input.payload ?? Prisma.JsonNull,
      },
    });
    this.gateway.pushToUser(input.userId, row);
    return row;
  }

  // Non-throwing wrapper used by the trade service — a notification failure
  // should never break the user-facing action that triggered it.
  async safeCreate(input: CreateNotificationInput): Promise<void> {
    try {
      await this.create(input);
    } catch (err) {
      this.logger.warn(
        `Failed to create ${input.type} notification for user ${input.userId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  // Non-throwing "resolve address → notify" helper for lifecycle callers.
  // The lookup + create are wrapped together so a thrown `userIdForAddress`
  // (Prisma outage, normalization failure, etc.) never bubbles up into the
  // trade endpoint and returns 500 after the trade state has been committed.
  async safeCreateForAddress(
    address: string,
    input: Omit<CreateNotificationInput, 'userId'>,
  ): Promise<void> {
    try {
      const userId = await this.userIdForAddress(address);
      if (!userId) return;
      await this.create({ ...input, userId });
    } catch (err) {
      this.logger.warn(
        `Failed to create ${input.type} notification for address ${address}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  async list(userId: string, query: ListNotificationQuery = {}) {
    const take = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const rows = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(query.unreadOnly ? { read: false } : {}),
      },
      // `id` tiebreaker keeps cursor pagination deterministic when multiple
      // rows share a `createdAt` timestamp — without it, pages can duplicate
      // or skip rows during bursts.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor
        ? { cursor: { id: query.cursor }, skip: 1 }
        : {}),
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;
    return { items, nextCursor };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  async markRead(userId: string, id: string): Promise<Notification | null> {
    // Idempotent for owned rows — re-marking an already-read notification
    // should return the row, not 404. Ownership check still gates non-owners
    // to `null` (→ 404) via the `count === 0` path.
    const row = await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true },
    });
    if (row.count === 0) return null;
    return this.prisma.notification.findUnique({ where: { id } });
  }

  async markAllRead(userId: string): Promise<number> {
    const res = await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return res.count;
  }

  // Resolve a wallet address back to the owning user. Returns null if no user
  // has linked this wallet yet — e.g. a counterparty who hasn't signed up.
  async userIdForAddress(address: string): Promise<string | null> {
    const normalized = (() => {
      try {
        return normalizeChainAddress(address);
      } catch {
        return address;
      }
    })();
    const wallet = await this.prisma.userWallet.findFirst({
      where: { address: normalized },
      select: { userId: true },
    });
    return wallet?.userId ?? null;
  }
}
