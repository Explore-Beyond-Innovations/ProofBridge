import { NotificationService } from './notification.service';
import type { NotificationGateway } from './notification.gateway';
import type { PrismaService } from '@prisma/prisma.service';
import type { Notification } from '@prisma/client';

describe('NotificationService', () => {
  const buildPrisma = () => ({
    notification: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    userWallet: {
      findFirst: jest.fn(),
    },
  });

  const buildGateway = () => ({ pushToUser: jest.fn() });

  const makeRow = (over: Partial<Notification> = {}): Notification => ({
    id: 'notif-1',
    userId: 'user-1',
    type: 'TRADE_CREATED',
    tradeId: 'trade-1',
    title: 'New order on your ad',
    body: 'A bridger placed an order.',
    payload: null,
    read: false,
    createdAt: new Date(),
    ...over,
  });

  let prisma: ReturnType<typeof buildPrisma>;
  let gateway: ReturnType<typeof buildGateway>;
  let service: NotificationService;

  beforeEach(() => {
    prisma = buildPrisma();
    gateway = buildGateway();
    service = new NotificationService(
      prisma as unknown as PrismaService,
      gateway as unknown as NotificationGateway,
    );
  });

  describe('create', () => {
    it('persists the row and pushes it through the gateway', async () => {
      const row = makeRow();
      prisma.notification.create.mockResolvedValue(row);

      const result = await service.create({
        userId: 'user-1',
        type: 'TRADE_CREATED',
        tradeId: 'trade-1',
        title: 'New order on your ad',
        body: 'A bridger placed an order.',
      });

      expect(result).toBe(row);
      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(gateway.pushToUser).toHaveBeenCalledWith('user-1', row);
    });
  });

  describe('safeCreate', () => {
    it('swallows persistence errors so the caller is never broken', async () => {
      prisma.notification.create.mockRejectedValue(new Error('boom'));

      await expect(
        service.safeCreate({
          userId: 'user-1',
          type: 'TRADE_CREATED',
          title: 't',
          body: 'b',
        }),
      ).resolves.toBeUndefined();
      expect(gateway.pushToUser).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns items + nextCursor when more rows exist beyond the page', async () => {
      const rows = [
        makeRow({ id: 'a' }),
        makeRow({ id: 'b' }),
        makeRow({ id: 'c' }),
      ];
      prisma.notification.findMany.mockResolvedValue(rows);

      const { items, nextCursor } = await service.list('user-1', { limit: 2 });

      expect(items.map((r) => r.id)).toEqual(['a', 'b']);
      expect(nextCursor).toBe('b');
    });

    it('returns a null cursor when the result fits in one page', async () => {
      prisma.notification.findMany.mockResolvedValue([makeRow()]);

      const { nextCursor } = await service.list('user-1', { limit: 20 });

      expect(nextCursor).toBeNull();
    });
  });

  describe('markRead', () => {
    it('returns the row when an unread match is found', async () => {
      const row = makeRow({ read: true });
      prisma.notification.updateMany.mockResolvedValue({ count: 1 });
      prisma.notification.findUnique.mockResolvedValue(row);

      const result = await service.markRead('user-1', 'notif-1');

      expect(result).toBe(row);
    });

    it('returns null when no unread match is found', async () => {
      prisma.notification.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.markRead('user-1', 'notif-1');

      expect(result).toBeNull();
      expect(prisma.notification.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('userIdForAddress', () => {
    it('returns null when no wallet is linked', async () => {
      prisma.userWallet.findFirst.mockResolvedValue(null);

      const result = await service.userIdForAddress(
        '0x1234567890123456789012345678901234567890',
      );

      expect(result).toBeNull();
    });

    it('returns the userId for a linked wallet', async () => {
      prisma.userWallet.findFirst.mockResolvedValue({ userId: 'user-1' });

      const result = await service.userIdForAddress(
        '0x1234567890123456789012345678901234567890',
      );

      expect(result).toBe('user-1');
    });
  });
});
