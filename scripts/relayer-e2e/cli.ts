// CLI entrypoint for the relayer e2e lifecycle.
//
// Usage:
//   tsx cli.ts deploy [--out <path>]
//   tsx cli.ts seed   [--in  <path>]
//   tsx cli.ts flows
//   tsx cli.ts all    [--out <path>]
//
// `deploy` brings up the on-chain state and writes a JSON snapshot.
// `seed` feeds that snapshot into Postgres via Prisma.
// `flows` drives the relayer over HTTP through the ad + trade lifecycles.
// `all` runs every step in-process; intended for local dev. In CI, the shell
// orchestrator in `e2e.sh` calls the subcommands individually so Docker can
// be started in between.

import * as fs from "fs";
import * as path from "path";
import { deploy } from "./lib/deploy.js";
import { seedDb, type DeployedContracts } from "./lib/seed.js";
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

async function cmdFlows(): Promise<void> {
  await runAdLifecycle();
  await runTradeLifecycle();
}

async function cmdAll(argv: string[]): Promise<void> {
  const out = parseFlag(argv, "--out") ?? defaultSnapshotPath();
  await deploy(out);
  const snapshot = readSnapshot(out);
  await seedDb(snapshot);
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
    case "flows":
      await cmdFlows();
      return;
    case "all":
      await cmdAll(rest);
      return;
    default:
      console.error(
        `Unknown command '${cmd ?? ""}'. Usage: tsx cli.ts {deploy|seed|flows|all} [--out/--in <path>]`,
      );
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
