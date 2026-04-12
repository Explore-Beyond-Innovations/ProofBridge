/**
 * Stellar CLI wrappers for contract deployment and invocation.
 */

import { execSync } from "child_process";

const NETWORK = process.env.STELLAR_NETWORK ?? "local";
const SOURCE = process.env.STELLAR_SOURCE_ACCOUNT ?? "alice";

function exec(cmd: string): string {
  const result = execSync(cmd, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    timeout: 120_000,
  });
  return result.trim();
}

/** Run a stellar CLI command, return stdout. */
export function stellar(args: string): string {
  const cmd = `stellar ${args}`;
  console.log(`  [stellar] ${cmd}`);
  return exec(cmd);
}

/** Deploy a contract WASM, return the contract ID (C... address). */
export function deployContract(
  wasmPath: string,
  constructorArgs: string[] = [],
): string {
  const ctorStr =
    constructorArgs.length > 0 ? `-- ${constructorArgs.join(" ")}` : "";
  const output = stellar(
    `contract deploy --wasm "${wasmPath}" --source "${SOURCE}" --network "${NETWORK}" ${ctorStr}`,
  );
  // Contract ID is the last non-empty line
  const lines = output.split("\n").filter((l) => l.trim());
  const contractId = lines[lines.length - 1].trim();
  if (!contractId.startsWith("C")) {
    throw new Error(`Unexpected deploy output: ${output}`);
  }
  return contractId;
}

/** Invoke a contract function, return stdout. */
export function invokeContract(
  contractId: string,
  fn: string,
  args: string[] = [],
  options: { send?: boolean; source?: string } = {},
): string {
  const sendFlag = options.send === false ? "--send no" : "--send yes";
  const source = options.source ?? SOURCE;
  const argsStr = args.length > 0 ? args.join(" ") : "";
  return stellar(
    `contract invoke --id "${contractId}" --source-account "${source}" --network "${NETWORK}" ${sendFlag} -- ${fn} ${argsStr}`,
  );
}

/** Get the public address for a named Stellar identity. */
export function getAddress(name: string = SOURCE): string {
  return stellar(`keys address "${name}"`);
}

/**
 * Idempotently generate a Stellar key under `name` and fund it via friendbot.
 * Safe to call repeatedly — existing keys / accounts are left alone.
 */
export function generateAndFundKey(name: string): string {
  try {
    stellar(`keys generate "${name}"`);
  } catch {
    // Already exists — leave it alone.
  }
  try {
    stellar(`keys fund "${name}" --network "${NETWORK}"`);
  } catch {
    // Already funded — fine.
  }
  return getAddress(name);
}

/**
 * Deploy a Stellar Asset Contract (SAC) for a classic asset, returning its
 * C... contract ID. If the SAC is already deployed, falls back to looking up
 * the id via `contract id asset`. Use `--asset native` for XLM.
 */
export function deploySAC(asset: string = "native"): string {
  try {
    return stellar(
      `contract asset deploy --asset "${asset}" --source "${SOURCE}" --network "${NETWORK}"`,
    );
  } catch {
    return stellar(
      `contract id asset --asset "${asset}" --source "${SOURCE}" --network "${NETWORK}"`,
    );
  }
}

/** Get the secret key for a named Stellar identity. */
export function getSecret(name: string = SOURCE): string {
  return stellar(`keys secret "${name}"`);
}

// ── Address format helpers ──────────────────────────────────────────

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(data: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let result = "";
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return result;
}

export function base32Decode(str: string): Uint8Array {
  const lookup: Record<string, number> = {};
  for (let i = 0; i < BASE32_ALPHABET.length; i++) {
    lookup[BASE32_ALPHABET[i]] = i;
  }
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of str) {
    value = (value << 5) | (lookup[ch] ?? 0);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

function crc16xmodem(data: Uint8Array): number {
  let crc = 0x0000;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc;
}

const STRKEY_ED25519 = 6 << 3; // 48 → G prefix
const STRKEY_CONTRACT = 2 << 3; // 16 → C prefix

function encodeStrkey(versionByte: number, payload: Buffer): string {
  const body = Buffer.concat([Buffer.from([versionByte]), payload]);
  const checksum = crc16xmodem(body);
  const full = Buffer.concat([
    body,
    Buffer.from([checksum & 0xff, (checksum >> 8) & 0xff]),
  ]);
  return base32Encode(full);
}

/** Decode a Stellar strkey address (C.../G...) to 32-byte hex. */
export function strkeyToHex(strkey: string): string {
  const decoded = base32Decode(strkey);
  // Skip version byte (1), take 32 bytes, skip checksum (2)
  const payload = decoded.slice(1, 33);
  return "0x" + Buffer.from(payload).toString("hex");
}

/** Encode 32-byte hex as C... (contract) address. */
export function hexToContractAddress(hex: string): string {
  const buf = Buffer.from(hex.replace(/^0x/i, ""), "hex");
  return encodeStrkey(STRKEY_CONTRACT, buf);
}

/** Encode 32-byte hex as G... (account) address. */
export function hexToAccountAddress(hex: string): string {
  const buf = Buffer.from(hex.replace(/^0x/i, ""), "hex");
  return encodeStrkey(STRKEY_ED25519, buf);
}

/** Convert an ed25519 public key (32-byte Buffer) to a Stellar G... address. */
export function pubkeyToAddress(pubkey: Buffer): string {
  return encodeStrkey(STRKEY_ED25519, pubkey);
}

/**
 * Convert a 20-byte EVM address to 32-byte hex (left-padded with zeros).
 * This is how EVM addresses are stored on the Stellar side and how EVM
 * contracts encode `address` values inside `bytes32` cross-chain fields.
 */
export function evmAddressToBytes32(evmAddr: string): string {
  const clean = evmAddr.replace(/^0x/i, "").toLowerCase().padStart(40, "0");
  return "0x" + "0".repeat(24) + clean;
}
