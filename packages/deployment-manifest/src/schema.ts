import { z } from "zod";
import { StrKey } from "@stellar/stellar-sdk";

// Addresses carried in two forms: `address` (human: EVM 0x+40hex or Stellar strkey)
// and `addressBytes32` (canonical 32-byte form used for cross-chain linking).

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const STRKEY_RE = /^[CG][A-Z2-7]{55}$/;
const STELLAR_PUBKEY_RE = /^G[A-Z2-7]{55}$/;
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

/** Stellar ed25519 public key (G...), not a contract (C...). */
export const StellarPublicKeySchema = z
  .string()
  .regex(STELLAR_PUBKEY_RE, "expected Stellar ed25519 public key (G...)");

// ── contracts ────────────────────────────────────────────────────────────

/** Human-readable chain address: 20-byte EVM hex or 56-char Stellar strkey. */
export const HumanAddressSchema = z.union([EvmAddressSchema, StrkeySchema]);

/** Canonical zero-padded 32-byte form expected for a given `address`. */
function expectedBytes32(address: string): string | null {
  if (EVM_ADDRESS_RE.test(address)) {
    return "0x" + "0".repeat(24) + address.slice(2).toLowerCase();
  }
  if (StrKey.isValidContract(address)) {
    return "0x" + StrKey.decodeContract(address).toString("hex");
  }
  if (StrKey.isValidEd25519PublicKey(address)) {
    return "0x" + StrKey.decodeEd25519PublicKey(address).toString("hex");
  }
  return null;
}

/** Cross-field refinement: `addressBytes32` must be the canonical encoding of `address`. */
function refineAddressPair(
  data: { address: string; addressBytes32: string },
  ctx: z.RefinementCtx,
): void {
  const expected = expectedBytes32(data.address);
  if (expected === null) {
    // Regex passed but checksum/version failed — don't let the pair sneak through unchecked.
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["address"],
      message: `address ${data.address} is not a valid EVM address or Stellar strkey (checksum/version failed)`,
    });
    return;
  }
  if (expected.toLowerCase() !== data.addressBytes32.toLowerCase()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["addressBytes32"],
      message: `addressBytes32 (${data.addressBytes32}) does not match address (${data.address}); expected ${expected}`,
    });
  }
}

export const ContractEntrySchema = z
  .object({
    address: HumanAddressSchema,
    addressBytes32: Bytes32Schema,
  })
  .superRefine(refineAddressPair);
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

export const TokenEntrySchema = z
  .object({
    /** Stable key that pairs tokens across chains (e.g. "eth", "xlm", "pb"). */
    pairKey: z.string().min(1),
    symbol: z.string().min(1),
    name: z.string().min(1),
    address: HumanAddressSchema,
    addressBytes32: Bytes32Schema,
    kind: TokenKindSchema,
    decimals: z.number().int().min(0).max(36),
    /** Stellar SAC-only: classic-asset issuer — must be an ed25519 pubkey (G...). */
    assetIssuer: StellarPublicKeySchema.nullable().optional(),
    /** `true` for deploy-time test tokens (MockERC20, test_token SEP-41, etc). */
    isTestToken: z.boolean().default(false),
  })
  .superRefine(refineAddressPair);
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
