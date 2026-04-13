import * as path from "path";
import {
  deployAll,
  writeDeployedSnapshot,
  type DeployAllResult,
} from "cross-chain-e2e/lib/deploy.js";

export async function deploy(outPath?: string): Promise<DeployAllResult> {
  const result = await deployAll();
  const snapshotPath = outPath ?? path.resolve(process.cwd(), "deployed.json");
  writeDeployedSnapshot(snapshotPath, result);
  return result;
}

export { deployAll, writeDeployedSnapshot };
