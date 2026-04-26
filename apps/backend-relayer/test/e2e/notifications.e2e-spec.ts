/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Wallet } from 'ethers';
import { createTestingApp } from '../setups/create-app';
import {
  loginUser,
  seedAd,
  seedChain,
  seedRoute,
  seedToken,
} from '../setups/utils';

describe('Notifications E2E', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  beforeAll(async () => {
    app = await createTestingApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const seedAdWithLoggedInCreator = async () => {
    const base = await seedChain(prisma, {
      name: `Base_${Date.now()}_${Math.random()}`,
      chainId: BigInt(800000 + Math.floor(Math.random() * 1000000)),
    });
    const eth = await seedChain(prisma, {
      name: `Ethereum_${Date.now()}_${Math.random()}`,
      chainId: BigInt(100 + Math.floor(Math.random() * 100000)),
    });
    const tBase = await seedToken(prisma, base.id, 'ETH');
    const tEth = await seedToken(prisma, eth.id, 'ETH');
    const route = await seedRoute(prisma, tBase.id, tEth.id);

    const creatorWallet = Wallet.createRandom();
    const bridgerWallet = Wallet.createRandom();

    // Log the creator in first so their wallet is linked to a user — the
    // notification lookup resolves `ad.creatorAddress` via UserWallet.
    const creatorAccess = await loginUser(
      app,
      creatorWallet.privateKey as `0x${string}`,
    );

    const ad = await seedAd(
      prisma,
      creatorWallet.address,
      route.id,
      tBase.id,
      tEth.id,
      1_000_000_000,
      'ACTIVE',
    );

    const bridgerAccess = await loginUser(
      app,
      bridgerWallet.privateKey as `0x${string}`,
    );

    return { route, ad, creatorAccess, bridgerAccess, bridgerWallet };
  };

  it('creates a TRADE_CREATED notification for the ad creator after a trade is created', async () => {
    const f = await seedAdWithLoggedInCreator();

    await request(app.getHttpServer())
      .post('/v1/trades/create')
      .set('Authorization', `Bearer ${f.bridgerAccess}`)
      .send({
        adId: f.ad.id,
        routeId: f.route.id,
        amount: '1000',
        bridgerDstAddress: f.bridgerWallet.address,
      })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${f.creatorAccess}`)
      .expect(200);

    const items = listRes.body.items as Array<{
      type: string;
      tradeId: string | null;
      read: boolean;
    }>;
    const found = items.find((n) => n.type === 'TRADE_CREATED');
    expect(found).toBeDefined();
    expect(found!.read).toBe(false);
  });

  it('GET /v1/notifications requires auth', async () => {
    await request(app.getHttpServer()).get('/v1/notifications').expect(401);
  });

  it('GET /v1/notifications/unread-count returns 0 for a fresh user', async () => {
    const wallet = Wallet.createRandom();
    const access = await loginUser(app, wallet.privateKey as `0x${string}`);

    const res = await request(app.getHttpServer())
      .get('/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${access}`)
      .expect(200);

    expect(res.body).toEqual({ count: 0 });
  });

  it('marks a notification as read via PATCH /:id/read', async () => {
    const f = await seedAdWithLoggedInCreator();

    await request(app.getHttpServer())
      .post('/v1/trades/create')
      .set('Authorization', `Bearer ${f.bridgerAccess}`)
      .send({
        adId: f.ad.id,
        routeId: f.route.id,
        amount: '1000',
        bridgerDstAddress: f.bridgerWallet.address,
      })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${f.creatorAccess}`)
      .expect(200);

    const unreadId = (listRes.body.items as Array<{ id: string; read: boolean }>)
      .find((n) => !n.read)!.id;

    const readRes = await request(app.getHttpServer())
      .patch(`/v1/notifications/${unreadId}/read`)
      .set('Authorization', `Bearer ${f.creatorAccess}`)
      .expect(200);

    expect(readRes.body.read).toBe(true);
  });

  it('marks all notifications as read via POST /read-all', async () => {
    const f = await seedAdWithLoggedInCreator();

    await request(app.getHttpServer())
      .post('/v1/trades/create')
      .set('Authorization', `Bearer ${f.bridgerAccess}`)
      .send({
        adId: f.ad.id,
        routeId: f.route.id,
        amount: '1000',
        bridgerDstAddress: f.bridgerWallet.address,
      })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/v1/notifications/read-all')
      .set('Authorization', `Bearer ${f.creatorAccess}`)
      .expect(200);

    expect(res.body.updated).toBeGreaterThanOrEqual(1);

    const countRes = await request(app.getHttpServer())
      .get('/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${f.creatorAccess}`)
      .expect(200);

    expect(countRes.body).toEqual({ count: 0 });
  });
});
