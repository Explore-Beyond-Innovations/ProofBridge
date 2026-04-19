import { promises as fs } from "fs";
import * as path from "path";
import {
  ChainDeploymentManifestSchema,
  CHAIN_DEPLOYMENT_MANIFEST_VERSION,
  type ChainDeploymentManifest,
} from "./schema.js";

export async function readManifest(
  filePath: string,
): Promise<ChainDeploymentManifest> {
  const raw = await fs.readFile(filePath, "utf8");
  return parseManifest(raw, filePath);
}

export function parseManifest(
  raw: string,
  sourceLabel: string = "<inline>",
): ChainDeploymentManifest {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (err) {
    throw new Error(`invalid JSON in manifest (${sourceLabel}): ${err}`);
  }
  const parsed = ChainDeploymentManifestSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(
      `manifest schema validation failed (${sourceLabel}):\n${parsed.error.issues
        .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
        .join("\n")}`,
    );
  }
  return parsed.data;
}

export async function writeManifest(
  filePath: string,
  manifest: ChainDeploymentManifest,
): Promise<void> {
  // Validate before write so callers can't persist a malformed manifest.
  ChainDeploymentManifestSchema.parse(manifest);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

/** Fetch a manifest over HTTP(S) — lets the seeder pull from a GitHub Release. */
export async function fetchManifest(
  url: string,
  timeoutMs = 30_000,
): Promise<ChainDeploymentManifest> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(
        `failed to fetch manifest from ${url}: ${res.status} ${res.statusText}`,
      );
    }
    return parseManifest(await res.text(), url);
  } catch (err) {
    if ((err as { name?: string }).name === "AbortError") {
      throw new Error(`timed out fetching manifest from ${url} after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export { CHAIN_DEPLOYMENT_MANIFEST_VERSION };
