import {
  StartedPostgreSqlContainer,
  PostgreSqlContainer,
} from '@testcontainers/postgresql';
import * as dotenv from 'dotenv';
import { execa } from 'execa';
import { rmSync } from 'fs';
import path from 'path';
import { seedDBe2e } from './seed';

// Load .env (optional)
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

let container: StartedPostgreSqlContainer;

async function migrate(databaseUrl: string) {
  // prisma migrate deploy
  await execa('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

export default async () => {
  // Wipe any leftover leveldb state from an aborted prior run before the
  // first MMRService boots — stale MANIFEST files can otherwise surface as
  // LEVEL_DATABASE_NOT_OPEN.
  rmSync(path.resolve(__dirname, '../../leveldb_data'), {
    recursive: true,
    force: true,
  });

  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('testdb')
    .withUsername('test')
    .withPassword('test')
    .start();

  const databaseUrl = container.getConnectionUri();
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = 'test';
  process.env.JWT_EXPIRY = '7d';
  process.env.JWT_REFRESH_EXPIRY = '30d';
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.SIGN_DOMAIN = process.env.SIGN_DOMAIN || 'proofbridge.xyz';
  process.env.SIGN_URI = process.env.SIGN_URI || 'https://proofbridge.xyz';
  process.env.STELLAR_AUTH_SECRET =
    process.env.STELLAR_AUTH_SECRET ||
    'SA3C2KPR5TCHYJ5TNQXAY2776Z3H4CB723GDCAMEX5I2NLWP25QUYB3X';
  process.env.SECRET_KEY =
    process.env.SECRET_KEY ||
    '0xfdba5a242ddce02cd1d585297aa4afe5aa2831391198746c680a3e16a41676dc';

  await migrate(databaseUrl);

  await seedDBe2e();

  (global as any).__PG_CONTAINER__ = container;
};
