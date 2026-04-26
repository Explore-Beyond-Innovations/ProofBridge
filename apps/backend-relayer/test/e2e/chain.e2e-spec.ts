/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestingApp } from '../setups/create-app';
import { randomUUID } from 'crypto';
import { loginAsAdmin, randomAddress } from '../setups/utils';

interface ChainResponse {
  id: string;
  name: string;
  chainId: string;
  adManagerAddress: string;
  orderPortalAddress: string;
}

describe('Chains E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestingApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/chains requires auth', async () => {
    await request(app.getHttpServer())
      .post('/v1/admin/chains/create')
      .send({
        name: 'FireChain',
        chainId: '10000',
        adManagerAddress: randomAddress(),
        orderPortalAddress: randomAddress(),
      })
      .expect(401);
  });

  describe('Chain CRUD operations', () => {
    let token: string;
    const chainId: string = '10000';
    let chainUUID: string;

    beforeEach(async () => {
      token = await loginAsAdmin(app);
    });

    it('creates a new chain', async () => {
      const adManagerAddress = randomAddress();
      const orderPortalAddress = randomAddress();
      const res = await request(app.getHttpServer())
        .post('/v1/admin/chains/create')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'FireChain',
          chainId,
          adManagerAddress,
          orderPortalAddress,
        })
        .expect(201);

      const created = res.body as ChainResponse;
      chainUUID = created.id;

      expect(created).toMatchObject({
        id: expect.any(String),
        name: 'FireChain',
        chainId,
        adManagerAddress,
        orderPortalAddress,
      });
    });

    it('gets chain by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}`)
        .expect(200);
      expect(res.body).toMatchObject({ chainId: chainId, name: 'FireChain' });
    });

    it('lists chains with chainId filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/chains')
        .query({ chainId: '10000' })
        .expect(200);
      expect(res.body.data).toEqual(
        expect.arrayContaining([expect.objectContaining({ chainId: chainId })]),
      );
    });

    it('updates chain details', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/v1/admin/chains/${chainUUID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ adManagerAddress: '0xAdMgrUpdated' })
        .expect(200);
      expect(res.body.adManagerAddress).toBe('0xAdMgrUpdated');
    });

    it('fails to update chain without auth', async () => {
      await request(app.getHttpServer())
        .patch(`/v1/admin/chains/${chainUUID}`)
        .send({ adManagerAddress: '0xAdMgrUpdated' })
        .expect(401);
    });

    it('fails to update non-existent chain', async () => {
      const fakeUUID = randomUUID();
      await request(app.getHttpServer())
        .patch(`/v1/admin/chains/${fakeUUID}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ adManagerAddress: '0xAdMgrUpdated' })
        .expect(404);
    });

    it('deletes a chain', async () => {
      await request(app.getHttpServer())
        .delete(`/v1/admin/chains/${chainUUID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}`)
        .expect(404);
    });

    it('fails to delete non-existent chain', async () => {
      const fakeUUID = randomUUID();
      await request(app.getHttpServer())
        .delete(`/v1/admin/chains/${fakeUUID}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
