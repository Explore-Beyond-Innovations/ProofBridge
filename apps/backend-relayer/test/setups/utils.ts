import { INestApplication } from '@nestjs/common';
import { ethers } from 'ethers';
import request from 'supertest';
import { SiweMessage } from 'siwe';
import { PrismaClient, ChainKind } from '@prisma/client';
import { hash } from '@node-rs/argon2';
import { privateKeyToAddress, signMessage } from 'viem/accounts';
import { Keypair, Networks, TransactionBuilder } from '@stellar/stellar-sdk';

export interface ChallengeResponse {
  nonce: string;
  address: `0x${string}`;
  expiresAt: string;
  domain: string;
  uri: string;
}

export const loginUser = async (
  app: INestApplication<any>,
  privateKey: `0x${string}`,
) => {
  const address = privateKeyToAddress(privateKey);

  // make challenge request
  const challenge = await request(app.getHttpServer())
    .post('/v1/auth/challenge')
    .send({ address, chainKind: ChainKind.EVM })
    .expect(200);

  const body = challenge.body as ChallengeResponse;

  const nowIso = new Date().toISOString();
  const expIso = new Date(Date.now() + 5 * 60_000).toISOString();

  // build SIWE message
  const msg = new SiweMessage({
    domain: body.domain,
    address: address,
    statement: 'Sign in to ProofBridge',
    uri: body.uri,
    version: '1',
    chainId: 1,
    nonce: body.nonce,
    issuedAt: nowIso,
    expirationTime: expIso,
  });

  const message = msg.prepareMessage();

  // sign message with wallet
  const signature = await signMessage({ message, privateKey });

  // send to login
  const res = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ message, signature, chainKind: ChainKind.EVM })
    .expect(201);

  return res.body.tokens.access as string;
};

export const loginStellarUser = async (
  app: INestApplication<any>,
  keypair: Keypair,
): Promise<string> => {
  const address = keypair.publicKey();

  const challenge = await request(app.getHttpServer())
    .post('/v1/auth/challenge')
    .send({ address, chainKind: ChainKind.STELLAR })
    .expect(200);

  const xdrString = challenge.body.transaction as string;
  const passphrase =
    (challenge.body.networkPassphrase as string) ||
    process.env.STELLAR_NETWORK_PASSPHRASE ||
    Networks.TESTNET;

  const tx = TransactionBuilder.fromXDR(xdrString, passphrase as Networks);
  tx.sign(keypair);
  const signedXdr = tx.toEnvelope().toXDR('base64');

  const res = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ transaction: signedXdr, chainKind: ChainKind.STELLAR })
    .expect(201);

  return res.body.tokens.access as string;
};

export const loginAsAdmin = async (app: INestApplication<any>) => {
  const res = await request(app.getHttpServer())
    .post('/v1/admin/login')
    .send({ email: 'admin@x.com', password: 'ChangeMe123!' })
    .expect(200);
  return res.body.tokens.access as string;
};

export const seedRoute = async (
  prisma: PrismaClient,
  adTokenId: string,
  orderTokenId: string,
) => {
  return prisma.route.create({
    data: { adTokenId, orderTokenId },
    select: { id: true },
  });
};

export const seedToken = async (
  prisma: PrismaClient,
  chainUuid: string,
  name: string = 'Ether',
  symbol = 'ETH',
  address?: string,
  kind: 'NATIVE' | 'ERC20' | 'SAC' | 'SEP41' = 'ERC20',
  decimals = 18,
) => {
  return prisma.token.upsert({
    where: {
      chainUid_address: {
        chainUid: chainUuid,
        address: address ?? randomAddress(),
      },
    },
    create: {
      chainUid: chainUuid,
      symbol,
      name: name,
      address: address ?? randomAddress(),
      decimals,
      kind,
    },
    update: {
      symbol,
      name: name,
      decimals,
      kind,
    },
    select: { id: true, symbol: true, chain: true },
  });
};

export const seedChain = async (
  prisma: PrismaClient,
  params?: Partial<{
    name: string;
    chainId: bigint;
    ad: string;
    op: string;
    kind: ChainKind;
  }>,
) => {
  const name = params?.name ?? `Chain-${Math.floor(Math.random() * 10000)}`;
  const chainId = params?.chainId ?? BigInt(Math.floor(Math.random() * 10000));
  const ad = params?.ad ?? randomAddress();
  const op = params?.op ?? randomAddress();
  const kind = params?.kind ?? ChainKind.EVM;

  return prisma.chain.upsert({
    where: {
      chainId: chainId,
    },
    create: {
      name,
      chainId: chainId,
      kind,
      adManagerAddress: ad,
      orderPortalAddress: op,
      mmr: {
        create: {
          chainId: chainId.toString(),
        },
      },
    },
    update: {
      name,
      kind,
      adManagerAddress: ad,
      orderPortalAddress: op,
    },
    select: { id: true, name: true, chainId: true },
  });
};

export const seedAdmin = async (
  prisma: PrismaClient,
  email: string,
  password: string,
) => {
  const passwordHash = await hash(password);
  return prisma.admin.upsert({
    where: { email },
    create: { email, passwordHash },
    update: { passwordHash },
  });
};

export const seedAd = async (
  prisma: PrismaClient,
  creator: string,
  routeId: string,
  adTokenId: string,
  orderTokenId: string,
  pool = 1_000_000,
  status: 'INACTIVE' | 'ACTIVE' | 'PAUSED' | 'CLOSED' = 'INACTIVE',
) =>
  prisma.ad.create({
    data: {
      creatorAddress: creator,
      routeId,
      adTokenId,
      orderTokenId,
      poolAmount: pool,
      status,
      creatorDstAddress: creator,
    },
    select: { id: true, creatorAddress: true, routeId: true },
  });

export function randomAddress() {
  const wallet = ethers.Wallet.createRandom();
  return wallet.address;
}

export const expectObject = (
  obj: any,
  fields: Partial<Record<string, any>>,
) => {
  for (const [k, v] of Object.entries(fields)) expect(obj[k]).toEqual(v);
};
