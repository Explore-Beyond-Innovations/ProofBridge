// Address helpers for the Stellar side. Cross-chain fields in the relayer are
// already stored as `0x`-prefixed 32-byte hex (the payload of a C.../G... strkey
// without version byte or checksum). These helpers convert between that hex
// form and the Stellar SDK's strkey representation.
//
// For chain records, `adManagerAddress`/`orderPortalAddress` hold the 32-byte
// hex form of the contract's C-strkey. The service decodes it back to a
// strkey before issuing RPC calls.

import { StrKey } from '@stellar/stellar-sdk';

const HEX32_RE = /^0x[a-fA-F0-9]{64}$/;
const HEX20_RE = /^0x[a-fA-F0-9]{40}$/;

export function hex32ToBuffer(hex: string): Buffer {
  if (HEX32_RE.test(hex)) return Buffer.from(hex.slice(2), 'hex');
  if (HEX20_RE.test(hex)) {
    // 20-byte EVM address: left-pad with 12 zero bytes so it fits the
    // bytes32 field shape used in cross-chain order params.
    const clean = hex.slice(2).toLowerCase();
    return Buffer.from('00'.repeat(12) + clean, 'hex');
  }
  throw new Error(
    `invalid bytes32-or-evm hex address: ${hex} (want 0x + 40 or 64 hex chars)`,
  );
}

export function bufferToHex32(buf: Buffer): `0x${string}` {
  if (buf.length !== 32) throw new Error('bufferToHex32: expected 32 bytes');
  return `0x${buf.toString('hex')}`;
}

// 32-byte hex → C-strkey (Soroban contract address).
export function hex32ToContractId(hex: string): string {
  return StrKey.encodeContract(hex32ToBuffer(hex));
}

// 32-byte hex → G-strkey (ed25519 account).
export function hex32ToAccountId(hex: string): string {
  return StrKey.encodeEd25519PublicKey(hex32ToBuffer(hex));
}

export function contractIdToHex32(strkey: string): `0x${string}` {
  return bufferToHex32(Buffer.from(StrKey.decodeContract(strkey)));
}

export function accountIdToHex32(strkey: string): `0x${string}` {
  return bufferToHex32(Buffer.from(StrKey.decodeEd25519PublicKey(strkey)));
}
