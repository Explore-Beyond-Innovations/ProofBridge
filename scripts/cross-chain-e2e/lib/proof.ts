/**
 * Proof generation for the cross-chain E2E test.
 * Adapted from contracts/stellar/tests/fixtures/generate_fixtures.ts
 */

import { Barretenberg, Fr, UltraHonkBackend } from "@aztec/bb.js";
import { Noir } from "@noir-lang/noir_js";
import { createRequire } from "module";
import { keccak256 as ethersKeccak256 } from "ethers";
import * as fs from "fs";
import * as path from "path";

// proofbridge-mmr is CJS with Object.defineProperty exports — Node ESM
// can't resolve named exports from that pattern, so use createRequire.
const require = createRequire(import.meta.url);
const { MerkleMountainRange: MMR, LevelDB, Poseidon2Hasher } = require("proofbridge-mmr");

// ── helpers ─────────────────────────────────────────────────────────

function keccak256(data: Buffer): Buffer {
  return Buffer.from(ethersKeccak256(data).replace(/^0x/, ""), "hex");
}

function hexToBytes32(hex: string): Buffer {
  const clean = hex.replace(/^0x/i, "").padStart(64, "0");
  return Buffer.from(clean, "hex");
}

function abiEncodeAddress(bytes32Hex: string): Buffer {
  return hexToBytes32(bytes32Hex);
}

function abiEncodeUint256(value: bigint): Buffer {
  const buf = Buffer.alloc(32, 0);
  const hex = value.toString(16).padStart(64, "0");
  Buffer.from(hex, "hex").copy(buf);
  return buf;
}

function padArray(arr: string[], targetLen = 20): string[] {
  const ZERO = `0x${"0".repeat(64)}`;
  return [...arr.map(String), ...Array(targetLen - arr.length).fill(ZERO)];
}

// ── EIP-712 (matching proofbridge-core/src/eip712.rs) ───────────────

const DOMAIN_TYPEHASH_MIN = keccak256(
  Buffer.from("EIP712Domain(string name,string version)"),
);
const NAME_HASH = keccak256(Buffer.from("Proofbridge"));
const VERSION_HASH = keccak256(Buffer.from("1"));
const ORDER_TYPEHASH = keccak256(
  Buffer.from(
    "Order(bytes32 orderChainToken,bytes32 adChainToken,uint256 amount,bytes32 bridger,uint256 orderChainId,bytes32 orderPortal,bytes32 orderRecipient,uint256 adChainId,bytes32 adManager,string adId,bytes32 adCreator,bytes32 adRecipient,uint256 salt)",
  ),
);

function domainSeparator(): Buffer {
  return keccak256(
    Buffer.concat([DOMAIN_TYPEHASH_MIN, NAME_HASH, VERSION_HASH]),
  );
}

export interface OrderParams {
  orderChainToken: string; // 32-byte hex
  adChainToken: string;
  amount: bigint;
  bridger: string;
  orderChainId: bigint;
  orderPortal: string;
  orderRecipient: string;
  adChainId: bigint;
  adManager: string;
  adId: string;
  adCreator: string;
  adRecipient: string;
  salt: bigint;
}

/** Compute EIP-712 struct hash for Order. */
function structHashOrder(p: OrderParams): Buffer {
  return keccak256(
    Buffer.concat([
      ORDER_TYPEHASH,
      abiEncodeAddress(p.orderChainToken),
      abiEncodeAddress(p.adChainToken),
      abiEncodeUint256(p.amount),
      abiEncodeAddress(p.bridger),
      abiEncodeUint256(p.orderChainId),
      abiEncodeAddress(p.orderPortal),
      abiEncodeAddress(p.orderRecipient),
      abiEncodeUint256(p.adChainId),
      abiEncodeAddress(p.adManager),
      keccak256(Buffer.from(p.adId)),
      abiEncodeAddress(p.adCreator),
      abiEncodeAddress(p.adRecipient),
      abiEncodeUint256(p.salt),
    ]),
  );
}

/** Compute EIP-712 typed data hash for an order. */
export function computeOrderHash(params: OrderParams): string {
  const structHash = structHashOrder(params);
  const prefix = Buffer.from([0x19, 0x01]);
  const hash = keccak256(
    Buffer.concat([prefix, domainSeparator(), structHash]),
  );
  return "0x" + hash.toString("hex");
}

/** Apply BN254 field modulus reduction. */
export function modOrderHash(orderHash: string): Fr {
  const buff = Buffer.from(orderHash.replace(/^0x/i, ""), "hex");
  return Fr.fromBufferReduce(buff);
}

// ── public inputs construction ──────────────────────────────────────

export function buildPublicInputs(
  nullifierHash: string,
  orderHashMod: string,
  targetRoot: string,
  chainFlag: number, // 0 = order chain, 1 = ad chain
): Buffer {
  const buf = Buffer.alloc(128);
  hexToBytes32(nullifierHash).copy(buf, 0);
  hexToBytes32(orderHashMod).copy(buf, 32);
  hexToBytes32(targetRoot).copy(buf, 64);
  const flagBuf = Buffer.alloc(32, 0);
  flagBuf[31] = chainFlag;
  flagBuf.copy(buf, 96);
  return buf;
}

// ── full proof generation pipeline ──────────────────────────────────

export interface ProofResult {
  orderHash: string;
  orderHashMod: Fr;
  targetRoot: string;
  bridgerNullifier: Fr;
  adCreatorNullifier: Fr;
  secret: string;
  bridgerProof: Uint8Array;
  bridgerPublicInputs: Buffer;
  adCreatorProof: Uint8Array;
  adCreatorPublicInputs: Buffer;
}

/**
 * Generate ZK proofs for both parties.
 * This is the full pipeline: order hash → MMR → nullifiers → proofs.
 */
export async function generateProofs(
  orderParams: OrderParams,
  circuitPath: string,
  secretHex?: string,
): Promise<ProofResult> {
  console.log("  Loading deposit circuit...");
  const circuit = JSON.parse(fs.readFileSync(circuitPath, "utf8"));

  console.log("  Initializing Barretenberg...");
  const bb = await Barretenberg.new();

  // Secret (deterministic or random)
  const secret =
    secretHex ?? "0x" + Buffer.from(Fr.random().toBuffer()).toString("hex");
  const secretBuf = Fr.fromString(secret).toBuffer();

  // Split secret into left/right halves
  const leftSide = Buffer.concat([
    Buffer.from(secretBuf.slice(0, 16)),
    Buffer.alloc(16, 0),
  ]);
  const rightSide = Buffer.concat([
    Buffer.alloc(16, 0),
    Buffer.from(secretBuf.slice(16, 32)),
  ]);
  const leftField = Fr.fromBufferReduce(leftSide);
  const rightField = Fr.fromBufferReduce(rightSide);

  // Compute order hash
  const orderHash = computeOrderHash(orderParams);
  console.log("  Order hash:", orderHash);

  const orderHashMod = modOrderHash(orderHash);
  console.log("  Order hash (field mod):", orderHashMod.toString());

  // Build MMR
  console.log("  Building MMR...");
  const dbPath = path.join("/tmp", "e2e-mmr-" + Date.now());
  const db = new LevelDB(dbPath);
  await db.init();
  const hasher = new Poseidon2Hasher();
  const mmr = new MMR("e2e-" + Date.now(), db, hasher);

  const elementIndex = await mmr.append(orderHashMod.toString());
  const merkleProof = await mmr.getMerkleProof(elementIndex);
  const targetRoot = await mmr.getHexRoot();
  console.log("  Target root:", targetRoot);

  // Compute nullifiers
  const bridgerNullifier = await bb.poseidon2Hash([leftField, orderHashMod]);
  const adCreatorNullifier = await bb.poseidon2Hash([orderHashMod, rightField]);
  console.log("  Bridger nullifier:", bridgerNullifier.toString());
  console.log("  Ad-creator nullifier:", adCreatorNullifier.toString());

  // Generate proofs
  const noir = new Noir(circuit);
  const honk = new UltraHonkBackend(circuit.bytecode, { threads: 2 });

  const commonInput = {
    order_hash: orderHashMod.toString(),
    secret,
    target_index: elementIndex.toString(),
    tree_width: merkleProof.width.toString(),
    target_sibling_hashes_len: merkleProof.siblings.length.toString(),
    target_sibling_hashes: padArray(
      merkleProof.siblings.map((s: any) => s.toString()),
    ),
    target_peak_hashes_len: merkleProof.peaks.length.toString(),
    target_peak_hashes: padArray(
      merkleProof.peaks.map((p: any) => p.toString()),
    ),
  };

  console.log("  Generating bridger proof (ad chain, chain_flag=1)...");
  const { witness: bridgerWitness } = await noir.execute({
    ...commonInput,
    nullifier_hash: bridgerNullifier.toString(),
    target_root: targetRoot,
    ad_contract: true,
  });
  const bridgerResult = await honk.generateProof(bridgerWitness, {
    keccak: true,
  });

  console.log("  Generating ad-creator proof (order chain, chain_flag=0)...");
  const { witness: adCreatorWitness } = await noir.execute({
    ...commonInput,
    nullifier_hash: adCreatorNullifier.toString(),
    target_root: targetRoot,
    ad_contract: false,
  });
  const adCreatorResult = await honk.generateProof(adCreatorWitness, {
    keccak: true,
  });

  // Build public inputs
  const bridgerPublicInputs = buildPublicInputs(
    bridgerNullifier.toString(),
    orderHashMod.toString(),
    targetRoot,
    1,
  );
  const adCreatorPublicInputs = buildPublicInputs(
    adCreatorNullifier.toString(),
    orderHashMod.toString(),
    targetRoot,
    0,
  );

  // Cleanup
  fs.rmSync(dbPath, { recursive: true, force: true });
  await bb.destroy();

  return {
    orderHash,
    orderHashMod,
    targetRoot,
    bridgerNullifier,
    adCreatorNullifier,
    secret,
    bridgerProof: bridgerResult.proof,
    bridgerPublicInputs,
    adCreatorProof: adCreatorResult.proof,
    adCreatorPublicInputs,
  };
}
