// Funds the frontend developer's dev wallets against the local docker stack.
//
// EVM:   sets native balance via `anvil_setBalance`, then mints ERC20Mock.
// Stellar: friendbot-funds the G-address against the local quickstart.
//
// Addresses are read from DEV_EVM_ADDRESS / DEV_STELLAR_ADDRESS. Any field
// left unset is skipped with a warning — funding is entirely best-effort.

import { ethers } from "ethers";
import type { DeployedContracts } from "./seed.js";

const DEFAULT_NATIVE_WEI = 10n ** 20n; // 100 ETH
const DEFAULT_TOKEN_UNITS = 1_000_000n; // 1,000,000 TT (pre-decimals)

export interface FundOpts {
  devEvmAddress?: string;
  devStellarAddress?: string;
  evmRpcUrl: string;
  stellarRpcUrl: string;
  /** Amount of native token units (already applied with 10^18). Defaults to 100 ETH. */
  nativeWei?: bigint;
  /** Human-readable token amount; converted using the snapshot decimals. Defaults to 1,000,000. */
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

  const tokenAddr = snapshot.eth.tokenAddress;
  const decimals = snapshot.eth.tokenDecimals ?? 18;
  const tokenAmount = (opts.tokenAmount ?? DEFAULT_TOKEN_UNITS) * 10n ** BigInt(decimals);

  const pk = requireEnv("EVM_ADMIN_PRIVATE_KEY");
  const signer = new ethers.Wallet(pk, provider);
  const token = new ethers.Contract(
    tokenAddr,
    ["function mint(address to, uint256 amount) external"],
    signer,
  );
  console.log(
    `[fund] EVM: minting ${tokenAmount} units of ${snapshot.eth.tokenSymbol} (${tokenAddr}) to ${addr}`,
  );
  const tx = await token.getFunction("mint")(addr, tokenAmount);
  await tx.wait();
}

async function fundStellar(
  _snapshot: DeployedContracts,
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
    if (res.status === 400 && /op_already_exists|createAccountAlreadyExist/i.test(body)) {
      console.log(`[fund] Stellar: account already funded, skipping.`);
      return;
    }
    throw new Error(
      `[fund] friendbot failed (${res.status}): ${body.slice(0, 200)}`,
    );
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[fund] ${name} must be set`);
  return v;
}
