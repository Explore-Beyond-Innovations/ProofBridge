// Canonical cross-chain Order hash, mirroring both the EVM EIP-712 typed-data
// encoding and Stellar's `eip712::hash_order` (contracts/stellar/…/eip712.rs).
// The Stellar contracts include this same hash over the bytes32-form order
// fields, so this one implementation serves both the EVM order signing and
// the Stellar request-hash `order_hash` parameter.

import { keccak256 } from 'viem';
import { T_OrderParams } from '../../../chain-adapters/types';
import { uuidToBigInt } from '../../viem/ethers/typedData';

function keccak(data: Buffer): Buffer {
  const hex = keccak256(`0x${data.toString('hex')}`);
  return Buffer.from(hex.slice(2), 'hex');
}

function hexToBytes32(hex: string): Buffer {
  const clean = hex.replace(/^0x/i, '').padStart(64, '0');
  return Buffer.from(clean, 'hex');
}

function u256BE(value: bigint): Buffer {
  const buf = Buffer.alloc(32, 0);
  const hex = value.toString(16).padStart(64, '0');
  Buffer.from(hex, 'hex').copy(buf);
  return buf;
}

const DOMAIN_TYPEHASH_MIN = keccak(
  Buffer.from('EIP712Domain(string name,string version)'),
);
const NAME_HASH = keccak(Buffer.from('Proofbridge'));
const VERSION_HASH = keccak(Buffer.from('1'));
const ORDER_TYPEHASH = keccak(
  Buffer.from(
    'Order(bytes32 orderChainToken,bytes32 adChainToken,uint256 amount,bytes32 bridger,uint256 orderChainId,bytes32 orderPortal,bytes32 orderRecipient,uint256 adChainId,bytes32 adManager,string adId,bytes32 adCreator,bytes32 adRecipient,uint256 salt,uint8 orderDecimals,uint8 adDecimals)',
  ),
);

function domainSeparator(): Buffer {
  return keccak(Buffer.concat([DOMAIN_TYPEHASH_MIN, NAME_HASH, VERSION_HASH]));
}

function structHashOrder(p: T_OrderParams): Buffer {
  return keccak(
    Buffer.concat([
      ORDER_TYPEHASH,
      hexToBytes32(p.orderChainToken),
      hexToBytes32(p.adChainToken),
      u256BE(BigInt(p.amount)),
      hexToBytes32(p.bridger),
      u256BE(BigInt(p.orderChainId)),
      hexToBytes32(p.orderPortal),
      hexToBytes32(p.orderRecipient),
      u256BE(BigInt(p.adChainId)),
      hexToBytes32(p.adManager),
      keccak(Buffer.from(p.adId)),
      hexToBytes32(p.adCreator),
      hexToBytes32(p.adRecipient),
      // salt is carried as a UUID string across the API; both EVM typedData
      // and the Stellar contracts encode it as a uint256 derived from the
      // raw 128-bit UUID. Use uuidToBigInt to match.
      u256BE(uuidToBigInt(p.salt)),
      u256BE(BigInt(p.orderDecimals)),
      u256BE(BigInt(p.adDecimals)),
    ]),
  );
}

export function computeOrderHash(params: T_OrderParams): `0x${string}` {
  const structHash = structHashOrder(params);
  const prefix = Buffer.from([0x19, 0x01]);
  const hash = keccak(Buffer.concat([prefix, domainSeparator(), structHash]));
  return `0x${hash.toString('hex')}`;
}
