/** Manifest loaders for the cross-chain-e2e test harness (contracts deployed by scripts/deploy/deploy-contracts.sh). */

import * as path from "path";
import * as fs from "fs";
import type { ethers } from "ethers";
import {
  readManifest as readEvmManifest,
  attachContract,
  connect as connectEvm,
  EVM_NATIVE_TOKEN_ADDRESS,
  type NonceTracker as EvmNonceTracker,
} from "@proofbridge/evm-deploy";
import {
  readManifest as readStellarManifest,
  DEFAULT_STELLAR_CHAIN_ID,
} from "@proofbridge/stellar-deploy";
import type {
  EvmContracts,
  EvmTokenDeployment,
} from "./evm.js";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`env ${name} not set`);
  return v;
}

export { DEFAULT_STELLAR_CHAIN_ID };
export const DEFAULT_EVM_CHAIN_ID = 31337n;

// ── result shapes ────────────────────────────────────────────────────

export interface StellarTokenDeployment {
  pairKey: string;
  name: string;
  symbol: string;
  contractId: string;
  addressHex: string;
  kind: "NATIVE" | "SAC" | "SEP41";
  decimals: number;
  assetIssuer: string | null;
}

export interface StellarDeployResult {
  verifier: string;
  merkleManager: string;
  wNativeToken: string;
  wNativeTokenHex: string;
  adManager: string;
  adManagerHex: string;
  orderPortal: string;
  orderPortalHex: string;
  tokens: StellarTokenDeployment[];
  adminStrkey: string;
  chainId: bigint;
}

export interface EvmDeployResult {
  chainId: bigint;
  signer: ethers.Wallet;
  nonces: EvmNonceTracker;
  contracts: EvmContracts;
  addresses: EvmContracts["addresses"];
}

export interface LoadAllOpts {
  evmRpcUrl?: string;
  evmAdminPrivateKey?: string;
  stellarAdminStrkey?: string;
  stellarChainId?: bigint;
  evmChainId?: bigint;
  /** Override manifest paths; defaults derived from ROOT_DIR + chainId. */
  evmManifestPath?: string;
  stellarManifestPath?: string;
}

export interface LoadAllResult {
  stellar: StellarDeployResult;
  evm: EvmDeployResult;
}

// ── manifest path resolution ────────────────────────────────────────

/** Locate the manifest for a chain using ROOT_DIR, with a cwd-relative fallback. */
function resolveManifestPath(
  chain: "evm" | "stellar",
  chainId: bigint,
): string {
  const rootDir = process.env.ROOT_DIR;
  if (rootDir) {
    return path.join(
      rootDir,
      "contracts",
      chain,
      "deployments",
      `${chainId}.json`,
    );
  }
  // Fallback: scripts/cross-chain-e2e/ → ../../contracts/<chain>/deployments
  const fallback = path.join(
    process.cwd(),
    "..",
    "..",
    "contracts",
    chain,
    "deployments",
    `${chainId}.json`,
  );
  if (!fs.existsSync(fallback)) {
    throw new Error(
      `cannot locate ${chain} manifest for chainId=${chainId} (set ROOT_DIR or run from scripts/cross-chain-e2e)`,
    );
  }
  return fallback;
}

// ── public loaders ───────────────────────────────────────────────────

/** Load EVM manifest + attach ethers.Contract for each core contract + token. */
export async function loadEvmDeployment(opts: {
  rpcUrl: string;
  adminPrivateKey: string;
  chainId: bigint;
  manifestPath?: string;
}): Promise<EvmDeployResult> {
  const manifestPath = opts.manifestPath ?? resolveManifestPath("evm", opts.chainId);
  const manifest = await readEvmManifest(manifestPath);
  if (manifest.chain.kind !== "EVM") {
    throw new Error(
      `[e2e] evm manifest ${manifestPath} has kind=${manifest.chain.kind}, expected EVM`,
    );
  }
  const { signer, nonces, chainId } = await connectEvm(
    opts.rpcUrl,
    opts.adminPrivateKey,
  );

  if (chainId !== opts.chainId) {
    throw new Error(
      `[e2e] connected chain id ${chainId} does not match expected ${opts.chainId}`,
    );
  }

  const verifier = attachContract(
    manifest.contracts.verifier.address,
    "Verifier",
    "HonkVerifier",
    signer,
  );
  const merkleManager = attachContract(
    manifest.contracts.merkleManager.address,
    "MerkleManager",
    "MerkleManager",
    signer,
  );
  const wNativeToken = attachContract(
    manifest.contracts.wNativeToken.address,
    "wNativeToken",
    "wNativeToken",
    signer,
  );
  const orderPortal = attachContract(
    manifest.contracts.orderPortal.address,
    "OrderPortal",
    "OrderPortal",
    signer,
  );
  const adManager = attachContract(
    manifest.contracts.adManager.address,
    "AdManager",
    "AdManager",
    signer,
  );

  const tokens: EvmTokenDeployment[] = manifest.tokens.map((t) => {
    // Reject tokens whose manifest kind isn't an EVM-native kind; silent
    // coercion to ERC20 would feed stellar strkeys into attachContract and
    // surface only much later as ABI decode errors.
    if (t.kind !== "NATIVE" && t.kind !== "ERC20") {
      throw new Error(
        `[e2e] evm manifest token pairKey=${t.pairKey} has kind=${t.kind}; expected NATIVE or ERC20`,
      );
    }
    return {
      pairKey: t.pairKey,
      name: t.name,
      symbol: t.symbol,
      address: t.address,
      kind: t.kind,
      decimals: t.decimals,
      contract:
        t.address.toLowerCase() === EVM_NATIVE_TOKEN_ADDRESS.toLowerCase()
          ? null
          : attachContract(t.address, "MockERC20", "MockERC20", signer),
    };
  });

  const addresses = {
    verifier: manifest.contracts.verifier.address,
    merkleManager: manifest.contracts.merkleManager.address,
    wNativeToken: manifest.contracts.wNativeToken.address,
    orderPortal: manifest.contracts.orderPortal.address,
    adManager: manifest.contracts.adManager.address,
  };

  return {
    chainId,
    signer,
    nonces,
    contracts: {
      verifier,
      merkleManager,
      wNativeToken,
      orderPortal,
      adManager,
      tokens,
      signer,
      nonces,
      addresses,
    },
    addresses,
  };
}

/** Load Stellar manifest; returns strkeys + bytes32 hex + tokens[] for run.ts. */
export async function loadStellarDeployment(opts: {
  chainId: bigint;
  adminStrkey: string;
  manifestPath?: string;
}): Promise<StellarDeployResult> {
  const manifestPath =
    opts.manifestPath ?? resolveManifestPath("stellar", opts.chainId);
  const manifest = await readStellarManifest(manifestPath);
  if (manifest.chain.kind !== "STELLAR") {
    throw new Error(
      `[e2e] stellar manifest ${manifestPath} has kind=${manifest.chain.kind}, expected STELLAR`,
    );
  }
  if (BigInt(manifest.chain.chainId) !== opts.chainId) {
    throw new Error(
      `[e2e] stellar manifest chain id ${manifest.chain.chainId} does not match expected ${opts.chainId}`,
    );
  }
  return {
    verifier: manifest.contracts.verifier.address,
    merkleManager: manifest.contracts.merkleManager.address,
    wNativeToken: manifest.contracts.wNativeToken.address,
    wNativeTokenHex: manifest.contracts.wNativeToken.addressBytes32,
    adManager: manifest.contracts.adManager.address,
    adManagerHex: manifest.contracts.adManager.addressBytes32,
    orderPortal: manifest.contracts.orderPortal.address,
    orderPortalHex: manifest.contracts.orderPortal.addressBytes32,
    tokens: manifest.tokens.map((t) => ({
      pairKey: t.pairKey,
      name: t.name,
      symbol: t.symbol,
      contractId: t.address,
      addressHex: t.addressBytes32,
      kind: t.kind as "NATIVE" | "SAC" | "SEP41",
      decimals: t.decimals,
      assetIssuer: t.assetIssuer ?? null,
    })),
    adminStrkey: opts.adminStrkey,
    chainId: opts.chainId,
  };
}

/** Load both sides. Contracts must already be deployed + linked. */
export async function loadAll(opts: LoadAllOpts = {}): Promise<LoadAllResult> {
  const evmRpcUrl = opts.evmRpcUrl ?? requireEnv("EVM_RPC_URL");
  const evmAdminPrivateKey =
    opts.evmAdminPrivateKey ?? requireEnv("EVM_ADMIN_PRIVATE_KEY");
  const stellarChainId = opts.stellarChainId ?? DEFAULT_STELLAR_CHAIN_ID;
  const evmChainId = opts.evmChainId ?? DEFAULT_EVM_CHAIN_ID;

  const { getAddress } = await import("@proofbridge/stellar-deploy");
  const stellarAdminStrkey = opts.stellarAdminStrkey ?? getAddress();

  const stellar = await loadStellarDeployment({
    chainId: stellarChainId,
    adminStrkey: stellarAdminStrkey,
    manifestPath: opts.stellarManifestPath,
  });
  const evm = await loadEvmDeployment({
    rpcUrl: evmRpcUrl,
    adminPrivateKey: evmAdminPrivateKey,
    chainId: evmChainId,
    manifestPath: opts.evmManifestPath,
  });
  return { stellar, evm };
}
