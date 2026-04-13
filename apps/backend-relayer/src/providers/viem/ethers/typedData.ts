import { TypedDataEncoder, Wallet, recoverAddress } from 'ethers';
import { ChainKind } from '@prisma/client';
import { StrKey } from '@stellar/stellar-sdk';
import { getAddress, isAddress } from 'viem';
import {
  Bytes32Hex,
  T_AdManagerOrderParams,
  T_OrderParams,
  T_OrderPortalParams,
} from '../../../chain-adapters/types';
import { accountIdToHex32 } from '../../stellar/utils/address';

// Left-pad a 20-byte EVM address to 32 bytes (the cross-chain wire format).
// Accepts an already-32-byte hex string and returns it unchanged. Throws on
// malformed input.
export function toBytes32(value: string): Bytes32Hex {
  const hex = value.replace(/^0x/i, '').toLowerCase();
  if (hex.length === 64) return `0x${hex}`;
  if (hex.length === 40) return `0x${'0'.repeat(24)}${hex}`;
  throw new Error(`toBytes32: expected 20- or 32-byte hex, got ${value}`);
}

// Chain-aware canonicalization for addresses. Returns the storage-canonical
// form:
//   EVM     — EIP-55 20-byte hex
//   STELLAR — lowercased 0x-prefixed 32-byte hex of the account public key
//
// When `chainKind` is provided, the native form is accepted (EVM 20-byte hex
// or Stellar G-strkey) alongside the 32-byte hex wire form.
// When `chainKind` is omitted, the chain is inferred from the canonical
// stored form: 40 hex chars → EVM, 64 hex chars → Stellar. Use this variant
// for values already read from the DB where the chain is implicit.
// Throws if the value is not a valid address for the given / inferred chain.
export function normalizeChainAddress(
  value: string,
  chainKind?: ChainKind,
): string {
  if (chainKind === ChainKind.EVM) {
    if (isAddress(value)) return getAddress(value);
    throw new Error(`normalizeChainAddress: invalid EVM address ${value}`);
  }
  if (chainKind === ChainKind.STELLAR) {
    if (StrKey.isValidEd25519PublicKey(value)) return accountIdToHex32(value);
    const hex = value.replace(/^0x/i, '');
    if (/^[a-fA-F0-9]{64}$/.test(hex)) return `0x${hex.toLowerCase()}`;
    throw new Error(`normalizeChainAddress: invalid Stellar address ${value}`);
  }
  const hex = value.replace(/^0x/i, '');
  if (hex.length === 40) return getAddress(`0x${hex}`);
  if (hex.length === 64) return `0x${hex.toLowerCase()}`;
  throw new Error(
    `normalizeChainAddress: cannot infer chain from ${value}; pass chainKind`,
  );
}

// ----------------------------
// OrderPortal typed data
// ----------------------------

export const domain = {
  name: 'Proofbridge',
  version: '1',
};

// ----------------------------
// OrderPortal typed data
// ----------------------------
// All address-like fields are bytes32 for cross-chain parity (Stellar
// addresses are 32 bytes; EVM addresses are left-padded with 12 zero bytes).
// Must match the on-chain ORDER_TYPEHASH in OrderPortal.sol / AdManager.sol
// and proofbridge-core/src/eip712.rs.
export const orderTypes: Record<string, { name: string; type: string }[]> = {
  Order: [
    { name: 'orderChainToken', type: 'bytes32' },
    { name: 'adChainToken', type: 'bytes32' },
    { name: 'amount', type: 'uint256' },
    { name: 'bridger', type: 'bytes32' },
    { name: 'orderChainId', type: 'uint256' },
    { name: 'orderPortal', type: 'bytes32' },
    { name: 'orderRecipient', type: 'bytes32' },
    { name: 'adChainId', type: 'uint256' },
    { name: 'adManager', type: 'bytes32' },
    { name: 'adId', type: 'string' },
    { name: 'adCreator', type: 'bytes32' },
    { name: 'adRecipient', type: 'bytes32' },
    { name: 'salt', type: 'uint256' },
  ],
};

export function getTypedHash(data: T_OrderParams) {
  const params = {
    ...data,
    salt: uuidToBigInt(data.salt),
  };
  const orderHash = TypedDataEncoder.hash(domain, orderTypes, params);
  return orderHash;
}

export function verifyTypedData(
  hash: `0x${string}`,
  signature: `0x${string}`,
  expectedAddress: `0x${string}`,
) {
  const recoveredAddress = recoverAddress(hash, signature);
  return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
}

export function uuidToBigInt(uuid: string): bigint {
  const hex = uuid.replace(/-/g, '');
  return BigInt('0x' + hex);
}

export function buildOrderParams(
  orderParams: T_OrderParams,
  isAdChain: boolean,
) {
  const {
    orderChainToken,
    adChainToken,
    amount,
    bridger,
    orderRecipient,
    adChainId,
    orderChainId,
    orderPortal,
    adManager,
    adId,
    adCreator,
    adRecipient,
    salt,
  } = orderParams;

  if (isAdChain) {
    const params: T_AdManagerOrderParams = {
      orderChainToken,
      adChainToken,
      amount,
      bridger,
      orderRecipient,
      orderChainId,
      srcOrderPortal: orderPortal,
      adId,
      adCreator,
      adRecipient,
      salt: uuidToBigInt(salt).toString(),
    };
    return params;
  } else {
    const params: T_OrderPortalParams = {
      orderChainToken,
      adChainToken,
      amount,
      bridger,
      orderRecipient,
      adChainId,
      adManager,
      adId,
      adCreator,
      adRecipient,
      salt: uuidToBigInt(salt).toString(),
    };
    return params;
  }
}

export async function signTypedOrder(signer: string, data: T_OrderParams) {
  const wallet = new Wallet(signer);
  const params = {
    ...data,
    salt: BigInt(data.salt),
  };
  const signature = await wallet.signTypedData(domain, orderTypes, params);
  return signature;
}
