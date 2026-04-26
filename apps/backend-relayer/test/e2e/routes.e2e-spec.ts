import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTestingApp } from '../setups/create-app';
import { seedChain, seedToken } from '../setups/utils';
import { randomUUID } from 'crypto';

describe('Routes E2E', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();

  const loginAsAdmin = async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/admin/login')
      .send({ email: 'admin@x.com', password: 'ChangeMe123!' })
      .expect(200);
    return res.body.tokens.access as string;
  };

  beforeAll(async () => {
    app = await createTestingApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('POST /v1/routes requires admin auth', async () => {
    await request(app.getHttpServer())
      .post('/v1/admin/routes/create')
      .send({ adTokenId: 't1', orderTokenId: 't2' })
      .expect(401);
  });

  it('creates a route, fetches it, lists by token ids', async () => {
    const access = await loginAsAdmin();

    const c1 = await seedChain(prisma);
    const c2 = await seedChain(prisma);

    const t1 = await seedToken(prisma, c1.id, 'ETH');
    const t2 = await seedToken(prisma, c2.id, 'ETH');

    // create
    const create = await request(app.getHttpServer())
      .post('/v1/admin/routes/create')
      .set('Authorization', `Bearer ${access}`)
      .send({
        adTokenId: t1.id,
        orderTokenId: t2.id,
      })
      .expect(201);

    expect(create.body).toMatchObject({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      id: expect.any(String),
      adToken: {
        id: t1.id,
        symbol: 'ETH',
        chain: { chainId: c1.chainId.toString() },
      },
      orderToken: {
        id: t2.id,
        symbol: 'ETH',
        chain: { chainId: c2.chainId.toString() },
      },
    });

    const routeId = create.body.id as string;

    // get by id
    const byId = await request(app.getHttpServer())
      .get(`/v1/routes/${routeId}`)
      .expect(200);
    expect(byId.body.id).toBe(routeId);

    // list by direct token ids
    const list = await request(app.getHttpServer())
      .get('/v1/routes')
      .query({ adTokenId: t1.id, orderTokenId: t2.id })
      .expect(200);
    expect(list.body.data.map((r: any) => r.id)).toContain(routeId);
  });

  it('lists by chain onchain ids + symbol', async () => {
    const base = await seedChain(prisma);
    const main = await seedChain(prisma);
    const tBase = await seedToken(prisma, base.id, 'ETH');
    const tMain = await seedToken(prisma, main.id, 'ETH');

    const access = await loginAsAdmin();
    const created = await request(app.getHttpServer())
      .post('/v1/admin/routes/create')
      .set('Authorization', `Bearer ${access}`)
      .send({ adTokenId: tBase.id, orderTokenId: tMain.id })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/v1/routes')
      .query({
        adChainId: base.chainId.toString(),
        orderChainId: main.chainId.toString(),
        symbol: 'ETH',
      })
      .expect(200);

    expect(list.body.data.map((r: any) => r.id)).toContain(created.body.id);
  });

  it('rejects creation of self-route (400)', async () => {
    const access = await loginAsAdmin();
    const ch = await seedChain(prisma);
    const tok = await seedToken(prisma, ch.id, 'ETH');

    await request(app.getHttpServer())
      .post('/v1/admin/routes/create')
      .set('Authorization', `Bearer ${access}`)
      .send({ adTokenId: tok.id, orderTokenId: tok.id })
      .expect(400);
  });

  it('rejects duplicate route (409)', async () => {
    const access = await loginAsAdmin();
    const c1 = await seedChain(prisma);
    const c2 = await seedChain(prisma);
    const t1 = await seedToken(prisma, c1.id, 'ETH');
    const t2 = await seedToken(prisma, c2.id, 'ETH');

    await request(app.getHttpServer())
      .post('/v1/admin/routes/create')
      .set('Authorization', `Bearer ${access}`)
      .send({ adTokenId: t1.id, orderTokenId: t2.id })
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/admin/routes/create')
      .set('Authorization', `Bearer ${access}`)
      .send({ adTokenId: t1.id, orderTokenId: t2.id })
      .expect(409);
  });

  it('DELETE /v1/routes/:id requires admin auth', async () => {
    const random = randomUUID();
    await request(app.getHttpServer())
      .delete(`/v1/admin/routes/${random}`)
      .expect(401);
  });

  it('deletes a route then 404 on get', async () => {
    const access = await loginAsAdmin();
    const c1 = await seedChain(prisma);
    const c2 = await seedChain(prisma);
    const t1 = await seedToken(prisma, c1.id, 'ETH');
    const t2 = await seedToken(prisma, c2.id, 'ETH');

    const created = await request(app.getHttpServer())
      .post('/v1/admin/routes/create')
      .set('Authorization', `Bearer ${access}`)
      .send({ adTokenId: t1.id, orderTokenId: t2.id })
      .expect(201);

    const id = created.body.id as string;

    await request(app.getHttpServer())
      .delete(`/v1/admin/routes/${id}`)
      .set('Authorization', `Bearer ${access}`)
      .expect(204);

    await request(app.getHttpServer()).get(`/v1/routes/${id}`).expect(404);
  });
});
