/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestingApp } from '../setups/create-app';
import { seedAd, seedChain, seedRoute, seedToken, loginUser } from '../setups/utils';
import { Wallet } from 'ethers';
import { randomUUID } from 'crypto';

describe('Trades E2E', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  const seedFixture = async () => {
    const base = await seedChain(prisma, {
      name: `Base_${Date.now()}`,
      chainId: BigInt(800000 + Math.floor(Math.random() * 1000000)),
    });
    const eth = await seedChain(prisma, {
      name: `Ethereum_${Date.now()}`,
      chainId: BigInt(100 + Math.floor(Math.random() * 100000)),
    });
    const tBase = await seedToken(prisma, base.id, 'ETH');
    const tEth = await seedToken(prisma, eth.id, 'ETH');
    const route = await seedRoute(prisma, tBase.id, tEth.id);

    const creatorWallet = Wallet.createRandom();
    const bridgerWallet = Wallet.createRandom();

    const ad = await seedAd(
      prisma,
      creatorWallet.address,
      route.id,
      tBase.id,
      tEth.id,
      1_000_000_000,
      'ACTIVE',
    );

    const access = await loginUser(app, bridgerWallet.privateKey as `0x${string}`);

    return { base, eth, route, ad, creatorWallet, bridgerWallet, access };
  };

  beforeAll(async () => {
    app = await createTestingApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('POST /v1/trades/create requires auth', async () => {
    await request(app.getHttpServer())
      .post('/v1/trades/create')
      .send({
        adId: randomUUID(),
        routeId: randomUUID(),
        amount: '1000',
        bridgerDstAddress: Wallet.createRandom().address,
      })
      .expect(401);
  });

  it('creates a trade (happy path)', async () => {
    const f = await seedFixture();

    const res = await request(app.getHttpServer())
      .post('/v1/trades/create')
      .set('Authorization', `Bearer ${f.access}`)
      .send({
        adId: f.ad.id,
        routeId: f.route.id,
        amount: '1000',
        bridgerDstAddress: f.bridgerWallet.address,
      })
      .expect(201);

    expect(res.body).toMatchObject({
      tradeId: expect.any(String),
      reqContractDetails: expect.objectContaining({
        chainId: expect.any(String),
        contractAddress: expect.any(String),
        signature: expect.any(String),
        authToken: expect.any(String),
        timeToExpire: expect.any(Number),
        reqHash: expect.any(String),
        orderHash: expect.any(String),
        orderParams: expect.any(Object),
      }),
    });
  });

  it('rejects trade on non-existent ad', async () => {
    const bridgerWallet = Wallet.createRandom();
    const access = await loginUser(
      app,
      bridgerWallet.privateKey as `0x${string}`,
    );

    await request(app.getHttpServer())
      .post('/v1/trades/create')
      .set('Authorization', `Bearer ${access}`)
      .send({
        adId: randomUUID(),
        routeId: randomUUID(),
        amount: '1000',
        bridgerDstAddress: bridgerWallet.address,
      })
      .expect(404);
  });

  it('rejects ad creator from bridging own ad', async () => {
    const f = await seedFixture();
    const creatorAccess = await loginUser(
      app,
      f.creatorWallet.privateKey as `0x${string}`,
    );

    await request(app.getHttpServer())
      .post('/v1/trades/create')
      .set('Authorization', `Bearer ${creatorAccess}`)
      .send({
        adId: f.ad.id,
        routeId: f.route.id,
        amount: '1000',
        bridgerDstAddress: f.creatorWallet.address,
      })
      .expect(400);
  });

  it('gets a trade by id', async () => {
    const f = await seedFixture();

    const create = await request(app.getHttpServer())
      .post('/v1/trades/create')
      .set('Authorization', `Bearer ${f.access}`)
      .send({
        adId: f.ad.id,
        routeId: f.route.id,
        amount: '1000',
        bridgerDstAddress: f.bridgerWallet.address,
      })
      .expect(201);

    const tradeId = create.body.tradeId as string;

    const byId = await request(app.getHttpServer())
      .get(`/v1/trades/${tradeId}`)
      .expect(200);

    expect(byId.body.id).toBe(tradeId);
  });

  it('lists trades with filters', async () => {
    const f = await seedFixture();

    const create = await request(app.getHttpServer())
      .post('/v1/trades/create')
      .set('Authorization', `Bearer ${f.access}`)
      .send({
        adId: f.ad.id,
        routeId: f.route.id,
        amount: '1000',
        bridgerDstAddress: f.bridgerWallet.address,
      })
      .expect(201);

    const tradeId = create.body.tradeId as string;

    const list = await request(app.getHttpServer())
      .get('/v1/trades/all')
      .query({
        routeId: f.route.id,
        adId: f.ad.id,
        bridgerAddress: f.bridgerWallet.address,
      })
      .expect(200);

    expect(list.body.data.map((t: any) => t.id)).toContain(tradeId);
  });
});
