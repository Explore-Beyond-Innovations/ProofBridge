/**
 * Shared chain deployment + cross-chain linking.
 *
 * Extracted from run.ts phases 1-3 so both the monolithic cross-chain-e2e
 * runner and the relayer-e2e script can share the same deploy path.
 *
 * The function signatures intentionally stay close to the inline originals so
 * run.ts could keep behaving identically before and after the refactor.
 */

import * as path from "path";
import * as fs from "fs";
import { ethers } from "ethers";
import {
  deployContract,
  deploySAC,
  invokeContract,
  strkeyToHex,
  evmAddressToBytes32,
} from "./stellar.js";
import { deployEvmContracts, NonceTracker, type EvmContracts } from "./evm.js";

// ── env / paths ───────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`env ${name} not set`);
  return v;
}

export const DEFAULT_STELLAR_CHAIN_ID = 1000001n;
export const DEFAULT_EVM_CHAIN_ID = 31337n; // Anvil default

// ── types ─────────────────────────────────────────────────────────────

export interface StellarDeployResult {
  verifier: string; // contract id (strkey)
  merkleManager: string;
  adToken: string; // native XLM SAC (strkey)
  adTokenHex: string; // 0x + 64 hex
  adManager: string; // strkey
  adManagerHex: string;
  orderPortal: string; // strkey
  orderPortalHex: string;
  adminStrkey: string;
  chainId: bigint;
}

export interface EvmDeployResult {
  chainId: bigint;
  signer: ethers.Wallet;
  nonces: NonceTracker;
  contracts: EvmContracts;
  addresses: EvmContracts["addresses"];
}

export interface DeployAllOpts {
  /** Absolute repo root. Defaults to process.env.ROOT_DIR. */
  rootDir?: string;
  /** Absolute path to compiled .wasm outputs. Defaults to {rootDir}/contracts/stellar/target/wasm32v1-none/release. */
  wasmDir?: string;
  /** Absolute path to the verifier vk bytes. Defaults to {rootDir}/proof_circuits/deposits/target/vk. */
  vkPath?: string;
  /** EVM JSON-RPC. Defaults to process.env.EVM_RPC_URL. */
  evmRpcUrl?: string;
  /** EVM admin private key (deployer + manager). Defaults to process.env.EVM_ADMIN_PRIVATE_KEY. */
  evmAdminPrivateKey?: string;
  /** Stellar chain id. */
  stellarChainId?: bigint;
  /** EVM chain id. */
  evmChainId?: bigint;
}

export interface DeployAllResult {
  stellar: StellarDeployResult;
  evm: EvmDeployResult;
}

// ── stellar ───────────────────────────────────────────────────────────

export interface DeployStellarOpts {
  wasmDir: string;
  vkPath: string;
  adminStrkey: string;
  chainId: bigint;
}

export function deployStellarChain(
  opts: DeployStellarOpts,
): StellarDeployResult {
  const { wasmDir, vkPath, adminStrkey, chainId } = opts;

  console.log("Deploying Stellar Verifier...");
  const verifier = deployContract(path.join(wasmDir, "verifier.wasm"), [
    `--vk_bytes-file-path`,
    vkPath,
  ]);
  console.log(`  Verifier: ${verifier}`);

  console.log("Deploying Stellar MerkleManager...");
  const merkleManager = deployContract(
    path.join(wasmDir, "merkle_manager.wasm"),
  );
  console.log(`  MerkleManager: ${merkleManager}`);
  invokeContract(merkleManager, "initialize", [`--admin`, adminStrkey]);

  console.log("Deploying native XLM SAC...");
  const adToken = deploySAC("native");
  const adTokenHex = strkeyToHex(adToken);
  console.log(`  NativeXLM SAC: ${adToken}`);

  console.log("Deploying Stellar AdManager...");
  const adManager = deployContract(path.join(wasmDir, "ad_manager.wasm"));
  console.log(`  AdManager: ${adManager}`);
  invokeContract(adManager, "initialize", [
    `--admin`,
    adminStrkey,
    `--verifier`,
    verifier,
    `--merkle_manager`,
    merkleManager,
    `--w_native_token`,
    adToken,
    `--chain_id`,
    chainId.toString(),
  ]);

  console.log("Deploying Stellar OrderPortal...");
  const orderPortal = deployContract(path.join(wasmDir, "order_portal.wasm"));
  console.log(`  OrderPortal: ${orderPortal}`);
  invokeContract(orderPortal, "initialize", [
    `--admin`,
    adminStrkey,
    `--verifier`,
    verifier,
    `--merkle_manager`,
    merkleManager,
    `--w_native_token`,
    adToken,
    `--chain_id`,
    chainId.toString(),
  ]);

  invokeContract(merkleManager, "set_manager", [
    `--manager`,
    adManager,
    `--status`,
    "true",
  ]);
  invokeContract(merkleManager, "set_manager", [
    `--manager`,
    orderPortal,
    `--status`,
    "true",
  ]);

  return {
    verifier,
    merkleManager,
    adToken,
    adTokenHex,
    adManager,
    adManagerHex: strkeyToHex(adManager),
    orderPortal,
    orderPortalHex: strkeyToHex(orderPortal),
    adminStrkey,
    chainId,
  };
}

// ── evm ───────────────────────────────────────────────────────────────

export interface DeployEvmOpts {
  rpcUrl: string;
  adminPrivateKey: string;
  chainId: bigint;
}

export async function deployEvmChain(
  opts: DeployEvmOpts,
): Promise<EvmDeployResult> {
  const contracts = await deployEvmContracts(opts.rpcUrl, opts.adminPrivateKey);
  return {
    chainId: opts.chainId,
    signer: contracts.signer,
    nonces: contracts.nonces,
    contracts,
    addresses: contracts.addresses,
  };
}

// ── cross-link ────────────────────────────────────────────────────────

export async function linkChains(
  stellar: StellarDeployResult,
  evm: EvmDeployResult,
): Promise<void> {
  const { contracts, nonces, chainId: evmChainId } = evm;
  const evmChainIdStr = evmChainId.toString();

  const evmOrderPortalBytes32 = evmAddressToBytes32(
    contracts.addresses.orderPortal,
  );
  const evmAdManagerBytes32 = evmAddressToBytes32(
    contracts.addresses.adManager,
  );
  const evmTokenBytes32 = evmAddressToBytes32(contracts.addresses.testToken);

  // ── Direction A: Stellar ad-side ↔ EVM order-side ──────────────────
  console.log("Linking Stellar AdManager → EVM OrderPortal...");
  invokeContract(stellar.adManager, "set_chain", [
    `--order_chain_id`,
    evmChainIdStr,
    `--order_portal`,
    evmOrderPortalBytes32.replace(/^0x/, ""),
    `--supported`,
    "true",
  ]);
  invokeContract(stellar.adManager, "set_token_route", [
    `--ad_token`,
    stellar.adTokenHex.replace(/^0x/, ""),
    `--order_token`,
    evmTokenBytes32.replace(/^0x/, ""),
    `--order_chain_id`,
    evmChainIdStr,
  ]);

  console.log("Linking EVM OrderPortal → Stellar AdManager...");
  {
    const tx = await contracts.orderPortal.getFunction("setChain")(
      stellar.chainId,
      stellar.adManagerHex,
      true,
      { nonce: nonces.next() },
    );
    await tx.wait();
  }
  {
    const tx = await contracts.orderPortal.getFunction("setTokenRoute")(
      contracts.addresses.testToken,
      stellar.chainId,
      stellar.adTokenHex,
      { nonce: nonces.next() },
    );
    await tx.wait();
  }

  // ── Direction B: EVM ad-side ↔ Stellar order-side ──────────────────
  console.log("Linking EVM AdManager → Stellar OrderPortal...");
  {
    const tx = await contracts.adManager.getFunction("setChain")(
      stellar.chainId,
      stellar.orderPortalHex,
      true,
      { nonce: nonces.next() },
    );
    await tx.wait();
  }
  {
    const tx = await contracts.adManager.getFunction("setTokenRoute")(
      contracts.addresses.testToken,
      stellar.chainId,
      stellar.adTokenHex,
      { nonce: nonces.next() },
    );
    await tx.wait();
  }

  console.log("Linking Stellar OrderPortal → EVM AdManager...");
  invokeContract(stellar.orderPortal, "set_chain", [
    `--ad_chain_id`,
    evmChainIdStr,
    `--ad_manager`,
    evmAdManagerBytes32.replace(/^0x/, ""),
    `--supported`,
    "true",
  ]);
  invokeContract(stellar.orderPortal, "set_token_route", [
    `--order_token`,
    stellar.adTokenHex.replace(/^0x/, ""),
    `--ad_chain_id`,
    evmChainIdStr,
    `--ad_token`,
    evmTokenBytes32.replace(/^0x/, ""),
  ]);

  console.log("Cross-chain linking complete.");
}

// ── top-level ─────────────────────────────────────────────────────────

export async function deployAll(
  opts: DeployAllOpts = {},
): Promise<DeployAllResult> {
  const rootDir = opts.rootDir ?? requireEnv("ROOT_DIR");
  const wasmDir =
    opts.wasmDir ??
    path.join(rootDir, "contracts/stellar/target/wasm32v1-none/release");
  const vkPath =
    opts.vkPath ?? path.join(rootDir, "proof_circuits/deposits/target/vk");
  const evmRpcUrl = opts.evmRpcUrl ?? requireEnv("EVM_RPC_URL");
  const evmAdminPrivateKey =
    opts.evmAdminPrivateKey ?? requireEnv("EVM_ADMIN_PRIVATE_KEY");
  const stellarChainId = opts.stellarChainId ?? DEFAULT_STELLAR_CHAIN_ID;
  const evmChainId = opts.evmChainId ?? DEFAULT_EVM_CHAIN_ID;

  const { getAddress } = await import("./stellar.js");
  const adminStrkey = getAddress();

  const stellar = deployStellarChain({
    wasmDir,
    vkPath,
    adminStrkey,
    chainId: stellarChainId,
  });

  const evm = await deployEvmChain({
    rpcUrl: evmRpcUrl,
    adminPrivateKey: evmAdminPrivateKey,
    chainId: evmChainId,
  });

  await linkChains(stellar, evm);

  return { stellar, evm };
}

/** Write a JSON snapshot of deployed addresses. Used by relayer-e2e to seed the DB. */
export function writeDeployedSnapshot(
  outPath: string,
  { stellar, evm }: DeployAllResult,
): void {
  const snapshot = {
    eth: {
      name: "AnvilLocal",
      chainId: evm.chainId.toString(),
      adManagerAddress: evm.addresses.adManager,
      orderPortalAddress: evm.addresses.orderPortal,
      merkleManagerAddress: evm.addresses.merkleManager,
      verifierAddress: evm.addresses.verifier,
      tokenName: "TestToken",
      tokenSymbol: "TT",
      tokenAddress: evm.addresses.testToken,
      tokenKind: "ERC20" as const,
      tokenDecimals: 18,
    },
    stellar: {
      name: "StellarLocal",
      chainId: stellar.chainId.toString(),
      adManagerAddress: stellar.adManagerHex,
      orderPortalAddress: stellar.orderPortalHex,
      merkleManagerAddress: strkeyToHex(stellar.merkleManager),
      verifierAddress: strkeyToHex(stellar.verifier),
      tokenName: "XLM",
      tokenSymbol: "XLM",
      tokenAddress: stellar.adTokenHex,
      tokenKind: "NATIVE" as const,
      tokenDecimals: 7,
      tokenAssetIssuer: null as string | null,
    },
  };
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`[deploy] wrote snapshot → ${outPath}`);
}
