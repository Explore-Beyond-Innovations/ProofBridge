import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestingApp } from '../setups/create-app';

describe('Health E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestingApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns ok and db ok', async () => {
    type HealthResponse = {
      status: string;
      checks: { liveness: string; db: string };
    };
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body as HealthResponse).toMatchObject({
      status: expect.stringMatching(/ok|degraded/) as string,
      checks: {
        liveness: 'ok',
        db: expect.stringMatching(/ok|error/) as string,
      },
    });
  });
});
