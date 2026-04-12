import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({
  path: path.resolve(process.cwd(), './.env'),
});

export const env = {
  db: {
    url: process.env.DATABASE_URL || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'mysecret',
    expiry: process.env.JWT_EXPIRY || '7d',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },
  isProd: process.env.NODE_ENV === 'production',
  port: process.env.PORT || 9090,
  appDomain: process.env.SIGN_DOMAIN || 'proofbridge.xyz',
  appUri: process.env.SIGN_URI || 'https://proofbridge.xyz',
  admin: process.env.ADMIN_SECRET || '',
  secretKey: process.env.SECRET_KEY || '32_byte_secret_key_for_aes!',
  evmRpcApiKey: process.env.EVM_RPC_API_KEY || '',
  rpcUrlHedera: process.env.RPC_URL_HEDERA || '',
  stellar: {
    adminSecret: process.env.STELLAR_ADMIN_SECRET || '',
    rpcUrl:
      process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
    networkPassphrase:
      process.env.STELLAR_NETWORK_PASSPHRASE ||
      'Test SDF Network ; September 2015',
    // SEP-10 server signing key. Separate from adminSecret so the auth
    // surface can't move funds and a compromise is bounded to issuing
    // challenges.
    authSecret: process.env.STELLAR_AUTH_SECRET || '',
  },
};
