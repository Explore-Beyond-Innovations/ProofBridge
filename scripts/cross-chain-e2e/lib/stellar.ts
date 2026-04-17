/**
 * Stellar CLI wrappers for contract deployment and invocation.
 */

import { execSync } from "child_process";

const NETWORK = process.env.STELLAR_NETWORK ?? "local";
const SOURCE = process.env.STELLAR_SOURCE_ACCOUNT ?? "alice";

/**
 * Shell-quote a single arg for POSIX sh. Flags (`--foo`) pass through;
 * values get wrapped in single quotes with internal quotes escaped so that
 * strings containing spaces (`Wrapped ETH`) survive the `execSync` shell.
 */
function shQuote(arg: string): string {
  if (arg.startsWith("--")) return arg;
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

function joinArgs(args: string[]): string {
  return args.map(shQuote).join(" ");
}

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
    constructorArgs.length > 0 ? `-- ${joinArgs(constructorArgs)}` : "";
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
  const argsStr = args.length > 0 ? joinArgs(args) : "";
  return stellar(
    `contract invoke --id "${contractId}" --source-account "${source}" --network "${NETWORK}" ${sendFlag} -- ${fn} ${argsStr}`,
  );
}

/** Get the public address for a named Stellar identity. */
export function getAddress(name: string = SOURCE): string {
  return stellar(`keys address "${name}"`);
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

/** Decode a Stellar strkey address (C.../G...) to 32-byte hex. */
export function strkeyToHex(strkey: string): string {
  const decoded = base32Decode(strkey);
  // Skip version byte (1), take 32 bytes, skip checksum (2)
  const payload = decoded.slice(1, 33);
  return "0x" + Buffer.from(payload).toString("hex");
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
