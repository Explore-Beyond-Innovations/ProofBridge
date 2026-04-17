// CLI entrypoint for the relayer e2e lifecycle.
//
// Usage:
//   tsx cli.ts deploy [--out <path>]
//   tsx cli.ts seed   [--in  <path>]
//   tsx cli.ts fund   [--in  <path>]
//   tsx cli.ts flows
//   tsx cli.ts all    [--out <path>]
//
// `deploy` brings up the on-chain state and writes a JSON snapshot.
// `seed`   feeds that snapshot into Postgres via Prisma.
// `fund`   tops up every known address with native + tradeable tokens:
//            - DEV_EVM_ADDRESS / DEV_STELLAR_ADDRESS (docker-local dev wallets;
//              Stellar side gets a friendbot call since it may be fresh)
//            - STELLAR_AD_CREATOR_SECRET / STELLAR_ORDER_CREATOR_SECRET
//              (flow identities; already friendbot-funded by start_chains.sh,
//              so only SEP-41 mints are needed)
//          Any env var left unset is skipped.
// `flows`  drives the relayer over HTTP through the ad + trade lifecycles.
// `all`    runs every step in-process; intended for local dev. In CI, the
//          shell orchestrator in `e2e.sh` calls the subcommands individually
//          so Docker can be started in between.

import * as fs from "fs";
import * as path from "path";
import { Keypair } from "@stellar/stellar-sdk";
import { privateKeyToAddress } from "viem/accounts";
import { deploy } from "./lib/deploy.js";
import { seedDb, type DeployedContracts } from "./lib/seed.js";
import { fundWallets, type StellarFundTarget } from "./lib/fund.js";
import { runAdLifecycle } from "./flows/ad-lifecycle.js";
import { runTradeLifecycle } from "./flows/trade-lifecycle.js";

function parseFlag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}

function defaultSnapshotPath(): string {
  return path.resolve(process.cwd(), "deployed.json");
}

function readSnapshot(p: string): DeployedContracts {
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw) as DeployedContracts;
}

async function cmdDeploy(argv: string[]): Promise<void> {
  const out = parseFlag(argv, "--out") ?? defaultSnapshotPath();
  await deploy(out);
}

async function cmdSeed(argv: string[]): Promise<void> {
  const inPath = parseFlag(argv, "--in") ?? defaultSnapshotPath();
  const snapshot = readSnapshot(inPath);
  await seedDb(snapshot);
}

async function cmdFund(argv: string[]): Promise<void> {
  const inPath = parseFlag(argv, "--in") ?? defaultSnapshotPath();
  const snapshot = readSnapshot(inPath);

  const target = (
    address: string | undefined,
    friendbot: boolean,
  ): StellarFundTarget[] => (address ? [{ address, friendbot }] : []);

  const fromStellarSecret = (secret: string | undefined): string | undefined =>
    secret ? Keypair.fromSecret(secret).publicKey() : undefined;

  const fromEvmKey = (key: string | undefined): string | undefined =>
    key ? privateKeyToAddress(key as `0x${string}`) : undefined;

  const evmAddresses = [
    process.env.DEV_EVM_ADDRESS,
    // Flow identities used by the trade-lifecycle — anvil pre-funds ETH but
    // the flow-specific ERC20s (wETH, PB) still need mints.
    fromEvmKey(process.env.EVM_AD_CREATOR_PRIVATE_KEY),
    fromEvmKey(process.env.EVM_ORDER_CREATOR_PRIVATE_KEY),
  ].filter((a): a is string => !!a);

  const stellarAddresses: StellarFundTarget[] = [
    // Dev wallet may be fresh — friendbot for XLM before minting SEP-41s.
    ...target(process.env.DEV_STELLAR_ADDRESS, true),
    // Flow identities are already friendbot-funded by start_chains.sh.
    ...target(fromStellarSecret(process.env.STELLAR_AD_CREATOR_SECRET), false),
    ...target(fromStellarSecret(process.env.STELLAR_ORDER_CREATOR_SECRET), false),
  ];

  if (evmAddresses.length === 0 && stellarAddresses.length === 0) {
    console.log("[cli] fund: no addresses configured — nothing to do.");
    return;
  }

  await fundWallets(snapshot, {
    evmAddresses,
    stellarAddresses,
    evmRpcUrl: requireEnv("EVM_RPC_URL"),
    stellarRpcUrl: requireEnv("STELLAR_RPC_URL"),
  });
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set`);
  return v;
}

async function cmdFlows(): Promise<void> {
  await runAdLifecycle();
  await runTradeLifecycle();
}

async function cmdAll(argv: string[]): Promise<void> {
  const out = parseFlag(argv, "--out") ?? defaultSnapshotPath();
  await deploy(out);
  await cmdSeed(["--in", out]);
  await cmdFund(["--in", out]);
  await cmdFlows();
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    case "deploy":
      await cmdDeploy(rest);
      return;
    case "seed":
      await cmdSeed(rest);
      return;
    case "fund":
      await cmdFund(rest);
      return;
    case "flows":
      await cmdFlows();
      return;
    case "all":
      await cmdAll(rest);
      return;
    default:
      console.error(
        `Unknown command '${cmd ?? ""}'. Usage: tsx cli.ts {deploy|seed|fund|flows|all} [--out/--in <path>]`,
      );
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
