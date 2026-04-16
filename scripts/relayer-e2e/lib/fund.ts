// Funds the frontend developer's dev wallets against the local docker stack.
//
// EVM:   sets native balance via `anvil_setBalance`, then mints each ERC20
//        tradeable token in the snapshot. Native-sentinel tokens are skipped.
// Stellar: friendbot-funds the G-address for XLM, then mints each SEP-41
//          tradeable token via the stellar CLI. NATIVE XLM has no mint.
//
// Addresses are read from DEV_EVM_ADDRESS / DEV_STELLAR_ADDRESS. Any field
// left unset is skipped with a warning — funding is entirely best-effort.

import { execFileSync } from "child_process";
import { ethers } from "ethers";
import type { DeployedContracts, DeployedTokenStellar } from "./seed.js";

const DEFAULT_NATIVE_WEI = 10n ** 20n; // 100 ETH
const DEFAULT_TOKEN_UNITS = 1_000_000n; // 1,000,000 (pre-decimals) per token

// Mirrors contracts/evm/src/{OrderPortal,AdManager}.sol NATIVE_TOKEN_ADDRESS.
const EVM_NATIVE_SENTINEL =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE".toLowerCase();

export interface FundOpts {
  devEvmAddress?: string;
  devStellarAddress?: string;
  evmRpcUrl: string;
  stellarRpcUrl: string;
  /** Amount of native token units (already applied with 10^18). Defaults to 100 ETH. */
  nativeWei?: bigint;
  /** Human-readable token amount; converted using each token's decimals. Defaults to 1,000,000. */
  tokenAmount?: bigint;
}

export async function fundDevWallets(
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
  const addr = opts.devEvmAddress?.trim();
  if (!addr) {
    console.log("[fund] DEV_EVM_ADDRESS not set — skipping EVM funding.");
    return;
  }
  if (!ethers.isAddress(addr)) {
    throw new Error(`[fund] DEV_EVM_ADDRESS is not a valid 0x address: ${addr}`);
  }

  const provider = new ethers.JsonRpcProvider(opts.evmRpcUrl);

  const nativeWei = opts.nativeWei ?? DEFAULT_NATIVE_WEI;
  console.log(
    `[fund] EVM: setting native balance of ${addr} to ${ethers.formatEther(nativeWei)} ETH`,
  );
  await provider.send("anvil_setBalance", [
    addr,
    "0x" + nativeWei.toString(16),
  ]);

  const pk = requireEnv("EVM_ADMIN_PRIVATE_KEY");
  const signer = new ethers.Wallet(pk, provider);
  const baseUnits = opts.tokenAmount ?? DEFAULT_TOKEN_UNITS;

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

async function fundStellar(
  snapshot: DeployedContracts,
  opts: FundOpts,
): Promise<void> {
  const addr = opts.devStellarAddress?.trim();
  if (!addr) {
    console.log("[fund] DEV_STELLAR_ADDRESS not set — skipping Stellar funding.");
    return;
  }
  if (!/^G[A-Z2-7]{55}$/.test(addr)) {
    throw new Error(
      `[fund] DEV_STELLAR_ADDRESS is not a valid G-strkey: ${addr}`,
    );
  }

  // STELLAR_RPC_URL looks like http://stellar:8000/soroban/rpc — friendbot
  // is served off the same host at /friendbot.
  const base = new URL(opts.stellarRpcUrl);
  const friendbotUrl = `${base.protocol}//${base.host}/friendbot?addr=${encodeURIComponent(addr)}`;

  console.log(`[fund] Stellar: friendbot-funding ${addr}`);
  const res = await fetch(friendbotUrl);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Friendbot returns 400 when the account is already funded — treat that
    // as success so reruns are idempotent.
    if (
      res.status === 400 &&
      /op_already_exists|createAccountAlreadyExist/i.test(body)
    ) {
      console.log(`[fund] Stellar: account already funded, skipping XLM step.`);
    } else {
      throw new Error(
        `[fund] friendbot failed (${res.status}): ${body.slice(0, 200)}`,
      );
    }
  }

  if (!snapshot.stellar) {
    console.log(
      "[fund] Stellar: snapshot has no stellar section — skipping SEP-41 mints.",
    );
    return;
  }

  const baseUnits = opts.tokenAmount ?? DEFAULT_TOKEN_UNITS;
  for (const tok of snapshot.stellar.tokens) {
    if (tok.kind !== "SEP41") {
      console.log(
        `[fund] Stellar: skipping mint for ${tok.symbol} (kind=${tok.kind}).`,
      );
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
