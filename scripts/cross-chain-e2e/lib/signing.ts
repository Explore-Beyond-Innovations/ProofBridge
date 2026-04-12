/**
 * Dual auth signing: ed25519 (Stellar) + ECDSA (EVM).
 *
 * Replicates proofbridge-core/src/auth.rs hash_request in TypeScript
 * and Solidity's hashRequest via abi.encode for EVM contracts.
 */

import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { ethers, keccak256 } from "ethers";

// noble/ed25519 v2 needs sha512 configured
ed.etc.sha512Sync = (...m: Uint8Array[]) => {
  const h = sha512.create();
  for (const msg of m) h.update(msg);
  return h.digest();
};

// ── keccak256 helper ────────────────────────────────────────────────

export function keccak(data: Buffer): Buffer {
  return Buffer.from(keccak256(data).replace(/^0x/, ""), "hex");
}

// ── request hash (mirrors proofbridge-core/src/auth.rs) ─────────────

/**
 * Compute the request hash exactly as the Stellar contracts do:
 *   keccak256(auth_token(32) || time_to_expire(8 BE) || keccak256(action)(32) || params(var) || chain_id(16 BE) || contract_address(32))
 */
export function hashRequest(
  authToken: Buffer, // 32 bytes
  timeToExpire: bigint, // u64
  action: string,
  params: Buffer, // variable length
  chainId: bigint, // u128
  contractAddress: Buffer // 32 bytes
): Buffer {
  const actionHash = keccak(Buffer.from(action));

  const timeBuf = Buffer.alloc(8);
  timeBuf.writeBigUInt64BE(timeToExpire);

  const chainBuf = Buffer.alloc(16);
  // u128 big-endian: write as two 64-bit halves
  chainBuf.writeBigUInt64BE(chainId >> 64n, 0);
  chainBuf.writeBigUInt64BE(chainId & 0xffffffffffffffffn, 8);

  const data = Buffer.concat([
    authToken,     // 32
    timeBuf,       // 8
    actionHash,    // 32
    params,        // variable
    chainBuf,      // 16
    contractAddress, // 32
  ]);

  return keccak(data);
}

/** Hash a string field with keccak256 (for ad_id in params). */
export function hashStringField(s: string): Buffer {
  return keccak(Buffer.from(s));
}

// ── request hash builders for specific actions ──────────────────────

export function createAdRequestHash(
  authToken: Buffer,
  timeToExpire: bigint,
  adId: string,
  adToken: Buffer, // 32 bytes
  amount: bigint, // u128
  orderChainId: bigint, // u128
  adRecipient: Buffer, // 32 bytes
  chainId: bigint,
  contractAddress: Buffer
): Buffer {
  // params: ad_id_hash(32) + ad_token(32) + amount(16) + order_chain_id(16) + ad_recipient(32) = 128
  const params = Buffer.alloc(128);
  hashStringField(adId).copy(params, 0);
  adToken.copy(params, 32);
  const amtBuf = Buffer.alloc(16);
  amtBuf.writeBigUInt64BE(amount >> 64n, 0);
  amtBuf.writeBigUInt64BE(amount & 0xffffffffffffffffn, 8);
  amtBuf.copy(params, 64);
  const chainBuf = Buffer.alloc(16);
  chainBuf.writeBigUInt64BE(orderChainId >> 64n, 0);
  chainBuf.writeBigUInt64BE(orderChainId & 0xffffffffffffffffn, 8);
  chainBuf.copy(params, 80);
  adRecipient.copy(params, 96);

  return hashRequest(authToken, timeToExpire, "createAd", params, chainId, contractAddress);
}

export function lockForOrderRequestHash(
  authToken: Buffer,
  timeToExpire: bigint,
  adId: string,
  orderHash: Buffer, // 32 bytes
  chainId: bigint,
  contractAddress: Buffer
): Buffer {
  // params: ad_id_hash(32) + order_hash(32) = 64
  const params = Buffer.alloc(64);
  hashStringField(adId).copy(params, 0);
  orderHash.copy(params, 32);
  return hashRequest(authToken, timeToExpire, "lockForOrder", params, chainId, contractAddress);
}

export function unlockOrderRequestHash(
  authToken: Buffer,
  timeToExpire: bigint,
  adId: string,
  orderHash: Buffer, // 32 bytes
  targetRoot: Buffer, // 32 bytes
  chainId: bigint,
  contractAddress: Buffer
): Buffer {
  // params: ad_id_hash(32) + order_hash(32) + target_root(32) = 96
  const params = Buffer.alloc(96);
  hashStringField(adId).copy(params, 0);
  orderHash.copy(params, 32);
  targetRoot.copy(params, 64);
  return hashRequest(authToken, timeToExpire, "unlockOrder", params, chainId, contractAddress);
}

// ── ed25519 signing ─────────────────────────────────────────────────

/** Sign a 32-byte message hash with ed25519. Returns 64-byte signature. */
export function signEd25519(message: Buffer, secretKey: Buffer): Buffer {
  const sig = ed.sign(message, secretKey);
  return Buffer.from(sig);
}

// ── auth token counter ──────────────────────────────────────────────

/** Generates unique 32-byte auth tokens for each call. */
export class AuthTokenCounter {
  private counter = 0;

  next(): Buffer {
    this.counter++;
    const buf = Buffer.alloc(32, 0);
    buf.writeUInt32BE(this.counter, 28);
    return buf;
  }
}

// ── EVM auth signing (matches Solidity's abi.encode pattern) ────────

const abiCoder = ethers.AbiCoder.defaultAbiCoder();

/**
 * Replicate Solidity's `hashRequest`:
 *   keccak256(abi.encode(authToken, timeToExpire, action, params, chainId, address(this)))
 *
 * `params` is a `bytes[]` — each element is already abi.encode'd.
 */
export function evmHashRequest(
  authToken: string, // bytes32 hex
  timeToExpire: bigint,
  action: string,
  params: string[], // each element is abi.encode(value) hex
  chainId: bigint,
  contractAddress: string // 20-byte address
): string {
  const encoded = abiCoder.encode(
    ["bytes32", "uint256", "string", "bytes[]", "uint256", "address"],
    [authToken, timeToExpire, action, params, chainId, contractAddress]
  );
  return keccak256(encoded);
}

/** Replicate OrderPortal.createOrderRequestHash. */
export function evmCreateOrderRequestHash(
  adId: string,
  orderHash: string, // bytes32 hex
  authToken: string,
  timeToExpire: bigint,
  chainId: bigint,
  contractAddress: string
): string {
  const params = [
    abiCoder.encode(["string"], [adId]),
    abiCoder.encode(["bytes32"], [orderHash]),
  ];
  return evmHashRequest(authToken, timeToExpire, "createOrder", params, chainId, contractAddress);
}

/** Replicate OrderPortal.unlockOrderRequestHash. */
export function evmUnlockOrderRequestHash(
  adId: string,
  orderHash: string,
  targetRoot: string,
  authToken: string,
  timeToExpire: bigint,
  chainId: bigint,
  contractAddress: string
): string {
  const params = [
    abiCoder.encode(["string"], [adId]),
    abiCoder.encode(["bytes32"], [orderHash]),
    abiCoder.encode(["bytes32"], [targetRoot]),
  ];
  return evmHashRequest(authToken, timeToExpire, "unlockOrder", params, chainId, contractAddress);
}

/**
 * Sign a message hash with ECDSA using ethers.js Wallet.
 * Applies Ethereum signed message prefix (matching Solidity's
 * MessageHashUtils.toEthSignedMessageHash + ECDSA.recover).
 */
export async function evmSignRequest(
  messageHash: string, // bytes32 hex
  signer: ethers.Wallet
): Promise<string> {
  // signMessage applies the "\x19Ethereum Signed Message:\n32" prefix
  const messageBytes = ethers.getBytes(messageHash);
  return signer.signMessage(messageBytes);
}
