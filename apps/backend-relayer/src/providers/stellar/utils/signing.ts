// Keccak256-based request-hash builders mirroring `proofbridge-core::auth` on
// Stellar (see contracts/stellar/contracts/ad-manager/src/auth.rs). These must
// byte-for-byte match what the Soroban contracts compute in `verify_request`.
//
// Port of scripts/cross-chain-e2e/lib/signing.ts — kept locally here so the
// backend-relayer doesn't depend on the test-harness package.

import { keccak256 } from 'viem';
import { ed25519 } from '@noble/curves/ed25519.js';
import { createHash, randomBytes } from 'crypto';

const U64_BE_LEN = 8;
const U128_BE_LEN = 16;
const BYTES32_LEN = 32;

export function keccak(data: Buffer): Buffer {
  const hex = keccak256(`0x${data.toString('hex')}`);
  return Buffer.from(hex.slice(2), 'hex');
}

export function hashStringField(s: string): Buffer {
  return keccak(Buffer.from(s));
}

function u64BE(value: bigint): Buffer {
  const buf = Buffer.alloc(U64_BE_LEN);
  buf.writeBigUInt64BE(value);
  return buf;
}

function u128BE(value: bigint): Buffer {
  const buf = Buffer.alloc(U128_BE_LEN);
  buf.writeBigUInt64BE(value >> 64n, 0);
  buf.writeBigUInt64BE(value & 0xffffffffffffffffn, 8);
  return buf;
}

// keccak256(auth_token(32) || time_to_expire(8 BE) || keccak256(action)(32)
//   || params(var) || chain_id(16 BE) || contract_address(32))
export function hashRequest(
  authToken: Buffer,
  timeToExpire: bigint,
  action: string,
  params: Buffer,
  chainId: bigint,
  contractAddress: Buffer,
): Buffer {
  if (authToken.length !== BYTES32_LEN)
    throw new Error('authToken must be 32 bytes');
  if (contractAddress.length !== BYTES32_LEN)
    throw new Error('contractAddress must be 32 bytes');

  return keccak(
    Buffer.concat([
      authToken,
      u64BE(timeToExpire),
      keccak(Buffer.from(action)),
      params,
      u128BE(chainId),
      contractAddress,
    ]),
  );
}

export function createAdRequestHash(opts: {
  authToken: Buffer;
  timeToExpire: bigint;
  adId: string;
  adToken: Buffer; // 32 bytes
  amount: bigint;
  orderChainId: bigint;
  adRecipient: Buffer; // 32 bytes
  chainId: bigint;
  contractAddress: Buffer;
}): Buffer {
  // params: ad_id_hash(32) + ad_token(32) + amount(16) + order_chain_id(16) + ad_recipient(32) = 128
  const params = Buffer.alloc(128);
  hashStringField(opts.adId).copy(params, 0);
  opts.adToken.copy(params, 32);
  u128BE(opts.amount).copy(params, 64);
  u128BE(opts.orderChainId).copy(params, 80);
  opts.adRecipient.copy(params, 96);
  return hashRequest(
    opts.authToken,
    opts.timeToExpire,
    'createAd',
    params,
    opts.chainId,
    opts.contractAddress,
  );
}

export function fundAdRequestHash(opts: {
  authToken: Buffer;
  timeToExpire: bigint;
  adId: string;
  amount: bigint;
  chainId: bigint;
  contractAddress: Buffer;
}): Buffer {
  // params: ad_id_hash(32) + amount(16) = 48
  const params = Buffer.alloc(48);
  hashStringField(opts.adId).copy(params, 0);
  u128BE(opts.amount).copy(params, 32);
  return hashRequest(
    opts.authToken,
    opts.timeToExpire,
    'fundAd',
    params,
    opts.chainId,
    opts.contractAddress,
  );
}

export function withdrawFromAdRequestHash(opts: {
  authToken: Buffer;
  timeToExpire: bigint;
  adId: string;
  amount: bigint;
  to: Buffer; // 32 bytes (bytes32-of-account)
  chainId: bigint;
  contractAddress: Buffer;
}): Buffer {
  // params: ad_id_hash(32) + amount(16) + to(32) = 80
  const params = Buffer.alloc(80);
  hashStringField(opts.adId).copy(params, 0);
  u128BE(opts.amount).copy(params, 32);
  opts.to.copy(params, 48);
  return hashRequest(
    opts.authToken,
    opts.timeToExpire,
    'withdrawFromAd',
    params,
    opts.chainId,
    opts.contractAddress,
  );
}

export function closeAdRequestHash(opts: {
  authToken: Buffer;
  timeToExpire: bigint;
  adId: string;
  to: Buffer; // 32 bytes
  chainId: bigint;
  contractAddress: Buffer;
}): Buffer {
  // params: ad_id_hash(32) + to(32) = 64
  const params = Buffer.alloc(64);
  hashStringField(opts.adId).copy(params, 0);
  opts.to.copy(params, 32);
  return hashRequest(
    opts.authToken,
    opts.timeToExpire,
    'closeAd',
    params,
    opts.chainId,
    opts.contractAddress,
  );
}

export function lockForOrderRequestHash(opts: {
  authToken: Buffer;
  timeToExpire: bigint;
  adId: string;
  orderHash: Buffer; // 32 bytes
  chainId: bigint;
  contractAddress: Buffer;
}): Buffer {
  // params: ad_id_hash(32) + order_hash(32) = 64
  const params = Buffer.alloc(64);
  hashStringField(opts.adId).copy(params, 0);
  opts.orderHash.copy(params, 32);
  return hashRequest(
    opts.authToken,
    opts.timeToExpire,
    'lockForOrder',
    params,
    opts.chainId,
    opts.contractAddress,
  );
}

export function createOrderRequestHash(opts: {
  authToken: Buffer;
  timeToExpire: bigint;
  adId: string;
  orderHash: Buffer; // 32 bytes
  chainId: bigint;
  contractAddress: Buffer;
}): Buffer {
  const params = Buffer.alloc(64);
  hashStringField(opts.adId).copy(params, 0);
  opts.orderHash.copy(params, 32);
  return hashRequest(
    opts.authToken,
    opts.timeToExpire,
    'createOrder',
    params,
    opts.chainId,
    opts.contractAddress,
  );
}

export function unlockOrderRequestHash(opts: {
  authToken: Buffer;
  timeToExpire: bigint;
  adId: string;
  orderHash: Buffer; // 32 bytes
  targetRoot: Buffer; // 32 bytes
  chainId: bigint;
  contractAddress: Buffer;
}): Buffer {
  // params: ad_id_hash(32) + order_hash(32) + target_root(32) = 96
  const params = Buffer.alloc(96);
  hashStringField(opts.adId).copy(params, 0);
  opts.orderHash.copy(params, 32);
  opts.targetRoot.copy(params, 64);
  return hashRequest(
    opts.authToken,
    opts.timeToExpire,
    'unlockOrder',
    params,
    opts.chainId,
    opts.contractAddress,
  );
}

// 32-byte random auth token — matches `BytesN<32> auth_token` on Stellar.
export function randomAuthToken(): Buffer {
  return randomBytes(32);
}

// Sign a 32-byte message with ed25519. Returns the 64-byte signature.
export function signEd25519(message: Buffer, seed: Buffer): Buffer {
  if (seed.length !== 32)
    throw new Error('ed25519 seed must be 32 bytes (raw secret)');
  return Buffer.from(ed25519.sign(message, seed));
}

export function ed25519PublicKey(seed: Buffer): Buffer {
  if (seed.length !== 32) throw new Error('ed25519 seed must be 32 bytes');
  return Buffer.from(ed25519.getPublicKey(seed));
}

export function verifyEd25519(
  message: Buffer,
  signature: Buffer,
  publicKey: Buffer,
): boolean {
  return ed25519.verify(signature, message, publicKey);
}

// Freighter's `signMessage` wraps the raw message string with a domain
// separator and sha256-hashes before ed25519 signing:
//   sha256("Stellar Signed Message:\n" + message) → 32-byte digest → ed25519.
// This builds that exact 32-byte preimage so the relayer can verify
// signatures produced by Freighter's API.
export function stellarSignedMessageDigest(message: string): Buffer {
  const prefix = Buffer.from('Stellar Signed Message:\n', 'utf8');
  const body = Buffer.from(message, 'utf8');
  return createHash('sha256').update(Buffer.concat([prefix, body])).digest();
}
