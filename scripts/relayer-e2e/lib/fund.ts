// Funds dev wallets and flow test identities against the local docker stack.
//
// EVM:    sets native balance via `anvil_setBalance`, then mints each ERC20
//         tradeable token in the snapshot. Native-sentinel tokens are skipped.
// Stellar: optionally friendbot-funds the G-address for XLM, then mints each
//          SEP-41 tradeable token via the stellar CLI. NATIVE XLM has no mint.
//
// Addresses are supplied by the caller; pass in any mix of dev wallets
// (DEV_EVM_ADDRESS / DEV_STELLAR_ADDRESS) and flow identities derived from
// STELLAR_{AD,ORDER}_CREATOR_SECRET. Flow identities are already friendbot-
// funded by start_chains.sh, so pass `friendbot: false` for those.

import { execFileSync } from "child_process";
import { ethers } from "ethers";
import type { DeployedContracts, DeployedTokenStellar } from "./seed.js";

const DEFAULT_NATIVE_WEI = 10n ** 20n; // 100 ETH
const DEFAULT_TOKEN_UNITS = 1_000_000n; // 1,000,000 (pre-decimals) per token

// Mirrors contracts/evm/src/{OrderPortal,AdManager}.sol NATIVE_TOKEN_ADDRESS.
const EVM_NATIVE_SENTINEL =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE".toLowerCase();

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
  /** Amount of native token units (already applied with 10^18). Defaults to 100 ETH. */
  nativeWei?: bigint;
  /** Human-readable token amount; converted using each token's decimals. Defaults to 1,000,000. */
  tokenAmount?: bigint;
}

export async function fundWallets(
  snapshot: DeployedContracts,
  opts: FundOpts,
): Promise<void> {
  await fundEvm(snapshot, opts);
  await fundStellar(snapshot, opts);
}

async function fundEvm(
  snapshot: DeployedContracts,
  opts: FundOpts,
): Promise<void> {
  const addresses = opts.evmAddresses
    .map((a) => a.trim())
    .filter((a) => a.length > 0);

  if (addresses.length === 0) {
    console.log("[fund] EVM: no addresses supplied — skipping EVM funding.");
    return;
  }

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

    for (const tok of snapshot.eth.tokens) {
      if (tok.address.toLowerCase() === EVM_NATIVE_SENTINEL) {
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
  snapshot: DeployedContracts,
  opts: FundOpts,
): Promise<void> {
  const targets = opts.stellarAddresses
    .map((t) => ({ ...t, address: t.address.trim() }))
    .filter((t) => t.address.length > 0);
  if (targets.length === 0) {
    console.log(
      "[fund] Stellar: no addresses supplied — skipping Stellar funding.",
    );
    return;
  }
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

    mintStellarSep41ToAddress(snapshot, target.address, opts.tokenAmount);
  }
}

function mintStellarSep41ToAddress(
  snapshot: DeployedContracts,
  addr: string,
  tokenAmount?: bigint,
): void {
  if (!snapshot.stellar) {
    console.log(
      "[fund] Stellar: snapshot has no stellar section — skipping SEP-41 mints.",
    );
    return;
  }

  const baseUnits = tokenAmount ?? DEFAULT_TOKEN_UNITS;
  for (const tok of snapshot.stellar.tokens) {
    if (tok.kind !== "SEP41") {
      continue;
    }
    if (!tok.contractId) {
      console.warn(
        `[fund] Stellar: ${tok.symbol} missing contractId in snapshot; cannot mint.`,
      );
      continue;
    }
    const amount = baseUnits * 10n ** BigInt(tok.decimals);
    console.log(
      `[fund] Stellar: minting ${baseUnits} ${tok.symbol} (${tok.contractId}) to ${addr}`,
    );
    stellarMint(tok, addr, amount);
  }
}

function stellarMint(
  tok: DeployedTokenStellar,
  to: string,
  amount: bigint,
): void {
  const network = process.env.STELLAR_NETWORK;
  const source = process.env.STELLAR_SOURCE_ACCOUNT;
  if (!network) throw new Error("[fund] STELLAR_NETWORK not set");
  if (!source) throw new Error("[fund] STELLAR_SOURCE_ACCOUNT not set");

  const args = [
    "contract",
    "invoke",
    "--id",
    tok.contractId!,
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
