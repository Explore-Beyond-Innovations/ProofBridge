import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestingApp } from '../setups/create-app';

describe('Admin E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestingApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/admin/login -> returns tokens for valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/admin/login')
      .send({ email: 'admin@x.com', password: 'ChangeMe123!' })
      .expect(200);

    /* eslint-disable @typescript-eslint/no-unsafe-assignment */
    expect(res.body).toMatchObject({
      tokens: { access: expect.any(String), refresh: expect.any(String) },
    });
  });

  it('POST /v1/admin/login -> 400 for missing fields or invalid ones', async () => {
    await request(app.getHttpServer())
      .post('/v1/admin/login')
      .send({ email: '', password: 'NoEmail#1' })
      .expect(400);

    // cannot set password < 8 chars
    await request(app.getHttpServer())
      .post('/v1/admin/login')
      .send({ email: 'admin@x.com', password: 'short' })
      .expect(400);
  });

  it('POST /v1/admin/login -> 401 for invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/v1/admin/login')
      .send({ email: 'admin@x.com', password: 'Wrong!98787' })
      .expect(401);
  });

  it('POST /v1/admin/addAdmin -> requires auth, creates new admin', async () => {
    // get an access token
    const login = await request(app.getHttpServer())
      .post('/v1/admin/login')
      .send({ email: 'admin@x.com', password: 'ChangeMe123!' })
      .expect(200);

    const access = login.body.tokens.access as string;

    // call protected endpoint with Authorization header
    await request(app.getHttpServer())
      .post('/v1/admin/addAdmin')
      .set('Authorization', `Bearer ${access}`)
      .send({ email: 'new@x.com', password: 'GoodPass#1' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/admin/login')
      .send({ email: 'new@x.com', password: 'GoodPass#1' })
      .expect(200);
  });

  it('POST /v1/admin/addAdmin -> 401 without token', async () => {
    await request(app.getHttpServer())
      .post('/v1/admin/addAdmin')
      .send({ email: 'noauth@x.com', password: 'Whatever#1' })
      .expect(401);
  });

  it('POST /v1/admin/addAdmin -> 401 with invalid token', async () => {
    await request(app.getHttpServer())
      .post('/v1/admin/addAdmin')
      .set('Authorization', 'Bearer not-a-jwt')
      .send({ email: 'badtoken@x.com', password: 'Whatever#1' })
      .expect(401);
  });
});
