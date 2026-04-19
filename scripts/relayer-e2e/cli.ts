// Relayer E2E CLI — HTTP-level harness. Deploy + seed live elsewhere
// (scripts/deploy/deploy-contracts.sh, `apps/backend-relayer seed:dev`).
//
//   tsx cli.ts fund  --evm-manifest <path> [--stellar-manifest <path>]
//   tsx cli.ts flows
//
// `fund` addresses come from env: DEV_{EVM,STELLAR}_ADDRESS,
// EVM_{AD,ORDER}_CREATOR_PRIVATE_KEY, STELLAR_{AD,ORDER}_CREATOR_SECRET.

import { Keypair } from "@stellar/stellar-sdk";
import { privateKeyToAddress } from "viem/accounts";
import { fundWallets, type StellarFundTarget } from "./lib/fund.js";
import { runAdLifecycle } from "./flows/ad-lifecycle.js";
import { runTradeLifecycle } from "./flows/trade-lifecycle.js";

function parseFlag(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  return argv[i + 1];
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} must be set`);
  return v;
}

async function cmdFund(argv: string[]): Promise<void> {
  const evmManifest = parseFlag(argv, "--evm-manifest");
  const stellarManifest = parseFlag(argv, "--stellar-manifest");
  if (!evmManifest) {
    throw new Error(
      "cli fund: --evm-manifest <path> is required (--stellar-manifest is optional)",
    );
  }

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

  await fundWallets({
    evmAddresses,
    stellarAddresses,
    evmRpcUrl: requireEnv("EVM_RPC_URL"),
    stellarRpcUrl: requireEnv("STELLAR_RPC_URL"),
    evmManifestPath: evmManifest,
    stellarManifestPath: stellarManifest,
  });
}

async function cmdFlows(): Promise<void> {
  await runAdLifecycle();
  await runTradeLifecycle();
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  switch (cmd) {
    case "fund":
      await cmdFund(rest);
      return;
    case "flows":
      await cmdFlows();
      return;
    default:
      console.error(
        `Unknown command '${cmd ?? ""}'.\n` +
          "Usage: tsx cli.ts {fund|flows} [flags]\n\n" +
          "  fund   --evm-manifest <path> [--stellar-manifest <path>]\n" +
          "  flows\n\n" +
          "For deploy + seed see scripts/deploy/deploy-contracts.sh and\n" +
          "apps/backend-relayer `pnpm seed:dev --config <seed.config.yaml>`.",
      );
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
