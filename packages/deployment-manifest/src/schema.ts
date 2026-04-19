import { z } from "zod";

// Addresses carried in two forms: `address` (human: EVM 0x+40hex or Stellar strkey)
// and `addressBytes32` (canonical 32-byte form used for cross-chain linking).

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const STRKEY_RE = /^[CG][A-Z2-7]{55}$/;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

export const ChainKindSchema = z.enum(["EVM", "STELLAR"]);
export type ChainKind = z.infer<typeof ChainKindSchema>;

export const TokenKindSchema = z.enum(["NATIVE", "ERC20", "SAC", "SEP41"]);
export type TokenKind = z.infer<typeof TokenKindSchema>;

export const Bytes32Schema = z
  .string()
  .regex(BYTES32_RE, "expected 0x-prefixed 64-hex string (32 bytes)");

export const EvmAddressSchema = z
  .string()
  .regex(EVM_ADDRESS_RE, "expected 0x-prefixed 40-hex EVM address");

export const StrkeySchema = z
  .string()
  .regex(STRKEY_RE, "expected Stellar strkey (C... or G...)");

// ── contracts ────────────────────────────────────────────────────────────

export const ContractEntrySchema = z.object({
  address: z.string().min(1),
  addressBytes32: Bytes32Schema,
});
export type ContractEntry = z.infer<typeof ContractEntrySchema>;

export const CoreContractsSchema = z.object({
  verifier: ContractEntrySchema,
  merkleManager: ContractEntrySchema,
  wNativeToken: ContractEntrySchema,
  adManager: ContractEntrySchema,
  orderPortal: ContractEntrySchema,
});
export type CoreContracts = z.infer<typeof CoreContractsSchema>;

// ── tokens ───────────────────────────────────────────────────────────────

export const TokenEntrySchema = z.object({
  /** Stable key that pairs tokens across chains (e.g. "eth", "xlm", "pb"). */
  pairKey: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string().min(1),
  address: z.string().min(1),
  addressBytes32: Bytes32Schema,
  kind: TokenKindSchema,
  decimals: z.number().int().min(0).max(36),
  /** Stellar SAC-only: classic-asset issuer strkey. */
  assetIssuer: z.string().nullable().optional(),
  /** `true` for deploy-time test tokens (MockERC20, test_token SEP-41, etc). */
  isTestToken: z.boolean().default(false),
});
export type TokenEntry = z.infer<typeof TokenEntrySchema>;

// ── meta ─────────────────────────────────────────────────────────────────

export const DeployMetaSchema = z.object({
  /** Absolute ISO-8601 timestamp (UTC). */
  deployedAt: z.string().datetime(),
  /** Address that paid for the deployment (strkey on Stellar, 0x on EVM). */
  deployer: z.string().min(1),
  /** Git commit sha of the contracts bundle. */
  commit: z.string().min(1),
  /** Logical environment: "local" / "testnet" / "mainnet" / custom. */
  env: z.string().min(1),
});
export type DeployMeta = z.infer<typeof DeployMetaSchema>;

// ── manifest ─────────────────────────────────────────────────────────────

export const CHAIN_DEPLOYMENT_MANIFEST_VERSION = 1 as const;

export const ChainDeploymentManifestSchema = z.object({
  version: z.literal(CHAIN_DEPLOYMENT_MANIFEST_VERSION),
  chain: z.object({
    name: z.string().min(1),
    kind: ChainKindSchema,
    /** Chain id as a decimal string to dodge BigInt-in-JSON pitfalls. */
    chainId: z.string().regex(/^\d+$/, "chainId must be a decimal string"),
  }),
  contracts: CoreContractsSchema,
  tokens: z.array(TokenEntrySchema),
  meta: DeployMetaSchema,
});
export type ChainDeploymentManifest = z.infer<
  typeof ChainDeploymentManifestSchema
>;
