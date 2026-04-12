/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestingApp } from '../setups/create-app';
import { Wallet } from 'ethers';
import { SiweMessage } from 'siwe';
import { env } from '@libs/configs';
import { ChainKind } from '@prisma/client';
import { LoginResponseDto } from '../../src/modules/auth/dto/auth.dto';

interface ChallengeResponse {
  nonce: string;
  address: string;
  expiresAt: string;
  domain: string;
  uri: string;
}

describe('SIWE E2E', () => {
  let app: INestApplication;
  const wallet = Wallet.createRandom();

  beforeAll(async () => {
    app = await createTestingApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/auth/challenge requires address parameter', async () => {
    await request(app.getHttpServer()).post('/v1/auth/challenge').expect(400);
  });

  it('POST /v1/auth/challenge rejects invalid address format', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/challenge')
      .send({ address: 'not-an-address' })
      .expect(400);
  });

  it('POST /v1/auth/challenge rejects empty address', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/challenge')
      .send({ address: '' })
      .expect(400);
  });

  it('should sign in with SIWE (challenge -> login)', async () => {
    // get nonce bound to address
    const prep = await request(app.getHttpServer())
      .post('/v1/auth/challenge')
      .send({ address: wallet.address, chainKind: ChainKind.EVM })
      .expect(200);

    const body = prep.body as ChallengeResponse;

    const nowIso = new Date().toISOString();
    const expIso = new Date(Date.now() + 5 * 60_000).toISOString();

    // build SIWE message
    const msg = new SiweMessage({
      domain: body.domain,
      address: wallet.address,
      statement: 'Sign in to ProofBridge',
      uri: body.uri,
      version: '1',
      chainId: 1,
      nonce: body.nonce,
      issuedAt: nowIso,
      expirationTime: expIso,
    });

    const message = msg.prepareMessage();

    // sign and verify
    const signature = await wallet.signMessage(message);

    const verify = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ message, signature, chainKind: ChainKind.EVM })
      .expect(201);

    expect(verify.body.user).toMatchObject({
      id: expect.any(String),
      username: expect.any(String),
    });
    expect(verify.body.tokens).toMatchObject({
      access: expect.any(String),
      refresh: expect.any(String),
    });
  });

  it('rejects wrong domain', async () => {
    const prep = await request(app.getHttpServer())
      .post('/v1/auth/challenge')
      .send({ address: wallet.address, chainKind: ChainKind.EVM })
      .expect(200);

    const body = prep.body as ChallengeResponse;

    const bad = new SiweMessage({
      domain: 'evil.xyz', // wrong
      address: wallet.address,
      statement: 'Sign in',
      uri: body.uri,
      version: '1',
      chainId: 1,
      nonce: body.nonce,
      issuedAt: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 5 * 60_000).toISOString(),
    });

    const message = bad.prepareMessage();
    const sig = await wallet.signMessage(message);

    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ message, signature: sig, chainKind: ChainKind.EVM })
      .expect(400);
  });

  it('rejects expired message', async () => {
    const prep = await request(app.getHttpServer())
      .post('/v1/auth/challenge')
      .send({ address: wallet.address, chainKind: ChainKind.EVM })
      .expect(200);

    const body = prep.body as ChallengeResponse;

    const now = new Date();

    // Set expiration in the past way behind the clock skew
    const expired = new Date(now.getTime() - 70000);

    const msg = new SiweMessage({
      domain: body.domain,
      address: wallet.address,
      statement: 'Sign in to ProofBridge',
      uri: body.uri,
      version: '1',
      chainId: 1,
      nonce: body.nonce,
      issuedAt: expired.toISOString(),
      expirationTime: expired.toISOString(),
    });

    const message = msg.prepareMessage();
    const signature = await wallet.signMessage(message);

    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ message, signature, chainKind: ChainKind.EVM })
      .expect(400);
  });

  it('rejects invalid signature', async () => {
    const prep = await request(app.getHttpServer())
      .post('/v1/auth/challenge')
      .send({ address: wallet.address, chainKind: ChainKind.EVM })
      .expect(200);

    const body = prep.body as ChallengeResponse;

    const msg = new SiweMessage({
      domain: body.domain,
      address: wallet.address,
      statement: 'Sign in to ProofBridge',
      uri: body.uri,
      version: '1',
      chainId: 1,
      nonce: body.nonce,
      issuedAt: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 5 * 60_000).toISOString(),
    });

    const message = msg.prepareMessage();
    const invalidSignature = '0x1234'; // Invalid signature

    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ message, signature: invalidSignature, chainKind: ChainKind.EVM })
      .expect(401);
  });

  it('rejects missing nonce', async () => {
    const msg = new SiweMessage({
      domain: env.appDomain,
      address: wallet.address,
      statement: 'Sign in to ProofBridge',
      uri: env.appUri,
      version: '1',
      chainId: 1,
      nonce: '30a30db69047450f8ca66f378f24102a',
      issuedAt: new Date().toISOString(),
      expirationTime: new Date(Date.now() + 5 * 60_000).toISOString(),
    });

    const message = msg.prepareMessage();
    const signature = await wallet.signMessage(message);

    await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ message, signature, chainKind: ChainKind.EVM })
      .expect(400);
  });

  it('POST /auth/refresh returns a fresh access token', async () => {
    const prep = await request(app.getHttpServer())
      .post('/v1/auth/challenge')
      .send({ address: wallet.address, chainKind: ChainKind.EVM })
      .expect(200);

    const body = prep.body as ChallengeResponse;
    const nowIso = new Date().toISOString();

    // build SIWE message
    const msg = new SiweMessage({
      domain: body.domain,
      address: wallet.address,
      statement: 'Sign in to ProofBridge',
      uri: body.uri,
      version: '1',
      chainId: 1,
      nonce: body.nonce,
      issuedAt: nowIso,
      expirationTime: body.expiresAt,
    });
    const message = msg.prepareMessage();
    const signature = await wallet.signMessage(message);

    const verifyResponse = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ message, signature, chainKind: ChainKind.EVM })
      .expect(201);

    const { tokens } = verifyResponse.body as LoginResponseDto;

    const res = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refresh: tokens.refresh })
      .expect(200);

    expect(res.body.tokens).toMatchObject({ access: expect.any(String) });
    const newAccess = res.body.tokens.access as string;
    expect(newAccess).not.toEqual(tokens.access);
  });

  it('rejects invalid refresh token', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refresh: 'not-a-jwt' })
      .expect(400);
  });
});
