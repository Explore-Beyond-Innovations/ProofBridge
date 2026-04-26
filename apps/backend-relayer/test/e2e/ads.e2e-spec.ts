/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestingApp } from '../setups/create-app';
import { Wallet } from 'ethers';
import { seedChain, seedToken, seedRoute, loginUser } from '../setups/utils';
import { randomUUID } from 'crypto';

describe('Ads E2E', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const userWallet = Wallet.createRandom();

  beforeAll(async () => {
    app = await createTestingApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('POST /v1/ads/create requires auth', async () => {
    await request(app.getHttpServer())
      .post('/v1/ads/create')
      .send({
        routeId: randomUUID(),
        creatorDstAddress: userWallet.address,
        fundAmount: '1000',
      })
      .expect(401);
  });

  it('creates an ad, persists INACTIVE row, then fetches it', async () => {
    const c1 = await seedChain(prisma);
    const c2 = await seedChain(prisma);
    const t1 = await seedToken(prisma, c1.id, 'ETH');
    const t2 = await seedToken(prisma, c2.id, 'ETH');
    const route = await seedRoute(prisma, t1.id, t2.id);

    const access = await loginUser(app, userWallet.privateKey as `0x${string}`);

    const create = await request(app.getHttpServer())
      .post('/v1/ads/create')
      .set('Authorization', `Bearer ${access}`)
      .send({
        routeId: route.id,
        creatorDstAddress: userWallet.address,
        fundAmount: '1000000000000000000',
      })
      .expect(201);

    expect(create.body).toMatchObject({
      adId: expect.any(String),
      chainId: expect.any(String),
      contractAddress: expect.any(String),
      signature: expect.any(String),
      authToken: expect.any(String),
      timeToExpire: expect.any(Number),
      initialAmount: '1000000000000000000',
      reqHash: expect.any(String),
    });

    const adId = create.body.adId as string;

    const byId = await request(app.getHttpServer())
      .get(`/v1/ads/${adId}`)
      .expect(200);

    expect(byId.body.id).toBe(adId);
    expect(byId.body.status).toBe('INACTIVE');
    expect(byId.body.poolAmount).toBe('0');
  });

  it('updates minAmount and maxAmount', async () => {
    const c1 = await seedChain(prisma);
    const c2 = await seedChain(prisma);
    const t1 = await seedToken(prisma, c1.id, 'ETH');
    const t2 = await seedToken(prisma, c2.id, 'ETH');
    const route = await seedRoute(prisma, t1.id, t2.id);

    const access = await loginUser(app, userWallet.privateKey as `0x${string}`);

    const create = await request(app.getHttpServer())
      .post('/v1/ads/create')
      .set('Authorization', `Bearer ${access}`)
      .send({
        routeId: route.id,
        creatorDstAddress: userWallet.address,
        fundAmount: '1000000000000000000',
      })
      .expect(201);

    const adId = create.body.adId as string;

    const update = await request(app.getHttpServer())
      .patch(`/v1/ads/${adId}/update`)
      .set('Authorization', `Bearer ${access}`)
      .send({ minAmount: '1000', maxAmount: '100000' })
      .expect(200);

    expect(update.body.minAmount).toBe('1000');
    expect(update.body.maxAmount).toBe('100000');
  });

  it('lists ads by routeId/creatorAddress filters', async () => {
    const c1 = await seedChain(prisma);
    const c2 = await seedChain(prisma);
    const t1 = await seedToken(prisma, c1.id, 'ETH');
    const t2 = await seedToken(prisma, c2.id, 'ETH');
    const route = await seedRoute(prisma, t1.id, t2.id);

    const access = await loginUser(app, userWallet.privateKey as `0x${string}`);

    const create = await request(app.getHttpServer())
      .post('/v1/ads/create')
      .set('Authorization', `Bearer ${access}`)
      .send({
        routeId: route.id,
        creatorDstAddress: userWallet.address,
        fundAmount: '1000000000000000000',
      })
      .expect(201);

    const adId = create.body.adId as string;

    const byRoute = await request(app.getHttpServer())
      .get('/v1/ads')
      .query({ routeId: route.id })
      .expect(200);
    expect(byRoute.body.data.map((a: any) => a.id)).toContain(adId);

    const byCreator = await request(app.getHttpServer())
      .get('/v1/ads')
      .query({ creatorAddress: userWallet.address })
      .expect(200);
    expect(byCreator.body.data.map((a: any) => a.id)).toContain(adId);
  });

  it('404 on unknown ad id', async () => {
    const randomUid = randomUUID();
    await request(app.getHttpServer()).get(`/v1/ads/${randomUid}`).expect(404);
  });
});
