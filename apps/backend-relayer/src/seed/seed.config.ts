// Seed config loader: YAML with admin + chain manifests (local paths or http(s) URLs).

import { promises as fs } from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  type ChainDeploymentManifest,
  fetchManifest,
  readManifest,
} from '@proofbridge/deployment-manifest';

export interface SeedConfigAdmin {
  email: string;
  /** Plain password — hashed with argon2 before upsert. */
  password: string;
}

export interface SeedConfigChainRef {
  /** Absolute path, path relative to the config file, or https:// URL. */
  manifest: string;
}

export interface SeedConfigRouteFilter {
  /** Allowlist of pairKeys to route; omit to route all common pairKeys. */
  include?: string[];
}

export interface SeedConfig {
  admin: SeedConfigAdmin;
  chains: SeedConfigChainRef[];
  routes?: SeedConfigRouteFilter;
}

export interface LoadedSeedConfig {
  admin: SeedConfigAdmin;
  manifests: ChainDeploymentManifest[];
  routes?: SeedConfigRouteFilter;
}

function isUrl(ref: string): boolean {
  return /^https?:\/\//i.test(ref);
}

function resolveRef(ref: string, configDir: string): string {
  if (isUrl(ref)) return ref;
  return path.isAbsolute(ref) ? ref : path.resolve(configDir, ref);
}

async function loadManifest(
  ref: string,
  configDir: string,
): Promise<ChainDeploymentManifest> {
  const resolved = resolveRef(ref, configDir);
  return isUrl(resolved) ? fetchManifest(resolved) : readManifest(resolved);
}

function parseRaw(raw: string, source: string): unknown {
  try {
    return yaml.load(raw);
  } catch (err) {
    throw new Error(`failed to parse seed config ${source}: ${err}`);
  }
}

function assertConfig(parsed: unknown, source: string): SeedConfig {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`seed config ${source}: expected an object at root`);
  }
  const cfg = parsed as Partial<SeedConfig>;
  if (!cfg.admin?.email || !cfg.admin?.password) {
    throw new Error(
      `seed config ${source}: 'admin.email' and 'admin.password' are required`,
    );
  }
  if (!Array.isArray(cfg.chains) || cfg.chains.length === 0) {
    throw new Error(
      `seed config ${source}: 'chains' must be a non-empty array`,
    );
  }
  for (const [i, ch] of cfg.chains.entries()) {
    if (!ch?.manifest) {
      throw new Error(
        `seed config ${source}: chains[${i}].manifest is required`,
      );
    }
  }
  return cfg as SeedConfig;
}

export async function loadSeedConfig(
  filePath: string,
): Promise<LoadedSeedConfig> {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = parseRaw(raw, filePath);
  const cfg = assertConfig(parsed, filePath);

  const configDir = path.dirname(path.resolve(filePath));
  const manifests = await Promise.all(
    cfg.chains.map((c) => loadManifest(c.manifest, configDir)),
  );

  const seen = new Set<string>();
  for (const m of manifests) {
    if (seen.has(m.chain.chainId)) {
      throw new Error(
        `seed config ${filePath}: duplicate chainId ${m.chain.chainId}`,
      );
    }
    seen.add(m.chain.chainId);
  }

  return { admin: cfg.admin, manifests, routes: cfg.routes };
}
