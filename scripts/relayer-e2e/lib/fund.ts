// Funds dev / flow identities: EVM via anvil_setBalance + ERC20 mint;
// Stellar via friendbot + SEP-41 mint. Reads contracts/<chain>/deployments/*.json.

import { execFileSync } from "child_process";
import { ethers } from "ethers";
import {
  readManifest,
  type ChainDeploymentManifest,
  type TokenEntry,
} from "@proofbridge/deployment-manifest";
import { EVM_NATIVE_TOKEN_ADDRESS } from "@proofbridge/evm-deploy";

const DEFAULT_NATIVE_WEI = 10n ** 20n; // 100 ETH
const DEFAULT_TOKEN_UNITS = 1_000_000n; // 1,000,000 (pre-decimals) per token

export interface StellarFundTarget {
  address: string;
  /** Run friendbot before minting SEP-41s. Set false if the account is already funded. */
  friendbot: boolean;
}

export interface FundOpts {
  evmAddresses: string[];
  stellarAddresses: StellarFundTarget[];
  evmRpcUrl: string;
  stellarRpcUrl: string;
  /** Path to the EVM deployment manifest. Required when any EVM address is supplied. */
  evmManifestPath?: string;
  /** Path to the Stellar deployment manifest. Required when any Stellar address is supplied. */
  stellarManifestPath?: string;
  /** Amount of native token units (already applied with 10^18). Defaults to 100 ETH. */
  nativeWei?: bigint;
  /** Human-readable token amount; converted using each token's decimals. Defaults to 1,000,000. */
  tokenAmount?: bigint;
}

export async function fundWallets(opts: FundOpts): Promise<void> {
  if (opts.evmAddresses.length > 0) {
    if (!opts.evmManifestPath) {
      throw new Error("[fund] evmAddresses supplied but evmManifestPath is missing");
    }
    await fundEvm(await readManifest(opts.evmManifestPath), opts);
  }
  if (opts.stellarAddresses.length > 0) {
    if (!opts.stellarManifestPath) {
      throw new Error("[fund] stellarAddresses supplied but stellarManifestPath is missing");
    }
    await fundStellar(await readManifest(opts.stellarManifestPath), opts);
  }
}

async function fundEvm(
  manifest: ChainDeploymentManifest,
  opts: FundOpts,
): Promise<void> {
  const addresses = opts.evmAddresses
    .map((a) => a.trim())
    .filter((a) => a.length > 0);

  for (const addr of addresses) {
    if (!ethers.isAddress(addr)) {
      throw new Error(`[fund] EVM: not a valid 0x address: ${addr}`);
    }
  }

  const provider = new ethers.JsonRpcProvider(opts.evmRpcUrl);
  const pk = requireEnv("EVM_ADMIN_PRIVATE_KEY");
  const signer = new ethers.Wallet(pk, provider);

  const nativeWei = opts.nativeWei ?? DEFAULT_NATIVE_WEI;
  const baseUnits = opts.tokenAmount ?? DEFAULT_TOKEN_UNITS;

  for (const addr of addresses) {
    console.log(
      `[fund] EVM: setting native balance of ${addr} to ${ethers.formatEther(nativeWei)} ETH`,
    );
    await provider.send("anvil_setBalance", [
      addr,
      "0x" + nativeWei.toString(16),
    ]);

    for (const tok of manifest.tokens) {
      if (tok.address.toLowerCase() === EVM_NATIVE_TOKEN_ADDRESS.toLowerCase()) {
        console.log(
          `[fund] EVM: skipping mint for ${tok.symbol} — native sentinel (covered by anvil_setBalance).`,
        );
        continue;
      }
      const amount = baseUnits * 10n ** BigInt(tok.decimals);
      const token = new ethers.Contract(
        tok.address,
        ["function mint(address to, uint256 amount) external"],
        signer,
      );
      console.log(
        `[fund] EVM: minting ${baseUnits} ${tok.symbol} (${tok.address}) to ${addr}`,
      );
      const tx = await token.getFunction("mint")(addr, amount);
      await tx.wait();
    }
  }
}

async function fundStellar(
  manifest: ChainDeploymentManifest,
  opts: FundOpts,
): Promise<void> {
  const targets = opts.stellarAddresses
    .map((t) => ({ ...t, address: t.address.trim() }))
    .filter((t) => t.address.length > 0);

  for (const t of targets) {
    if (!/^G[A-Z2-7]{55}$/.test(t.address)) {
      throw new Error(`[fund] Stellar: not a valid G-strkey: ${t.address}`);
    }
  }

  const base = new URL(opts.stellarRpcUrl);

  for (const target of targets) {
    if (target.friendbot) {
      const friendbotUrl = `${base.protocol}//${base.host}/friendbot?addr=${encodeURIComponent(target.address)}`;
      console.log(`[fund] Stellar: friendbot-funding ${target.address}`);
      const res = await fetch(friendbotUrl);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        // Friendbot returns 400 when the account is already funded — treat
        // that as success so reruns are idempotent.
        if (
          res.status === 400 &&
          /op_already_exists|createAccountAlreadyExist/i.test(body)
        ) {
          console.log(
            `[fund] Stellar: ${target.address} already funded, skipping XLM step.`,
          );
        } else {
          throw new Error(
            `[fund] friendbot failed (${res.status}): ${body.slice(0, 200)}`,
          );
        }
      }
    }
    mintStellarSep41ToAddress(manifest, target.address, opts.tokenAmount);
  }
}

function mintStellarSep41ToAddress(
  manifest: ChainDeploymentManifest,
  addr: string,
  tokenAmount?: bigint,
): void {
  const baseUnits = tokenAmount ?? DEFAULT_TOKEN_UNITS;
  for (const tok of manifest.tokens) {
    if (tok.kind !== "SEP41") continue;
    const amount = baseUnits * 10n ** BigInt(tok.decimals);
    console.log(
      `[fund] Stellar: minting ${baseUnits} ${tok.symbol} (${tok.address}) to ${addr}`,
    );
    stellarMint(tok, addr, amount);
  }
}

function stellarMint(tok: TokenEntry, to: string, amount: bigint): void {
  const network = process.env.STELLAR_NETWORK;
  const source = process.env.STELLAR_SOURCE_ACCOUNT;
  if (!network) throw new Error("[fund] STELLAR_NETWORK not set");
  if (!source) throw new Error("[fund] STELLAR_SOURCE_ACCOUNT not set");

  const args = [
    "contract",
    "invoke",
    "--id",
    tok.address,
    "--source-account",
    source,
    "--network",
    network,
    "--send",
    "yes",
    "--",
    "mint",
    "--to",
    to,
    "--amount",
    amount.toString(),
  ];
  execFileSync("stellar", args, { stdio: "inherit" });
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[fund] ${name} must be set`);
  return v;
}
