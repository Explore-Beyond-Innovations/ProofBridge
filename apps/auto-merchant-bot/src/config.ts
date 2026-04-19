import { z } from "zod"

const EnvSchema = z.object({
  BACKEND_URL: z.string().url(),
  EVM_ADMIN_PRIVATE_KEY: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, "EVM_ADMIN_PRIVATE_KEY must be 0x + 64 hex"),
  STELLAR_ADMIN_SECRET: z
    .string()
    .regex(/^S[A-Z2-7]{55}$/, "STELLAR_ADMIN_SECRET must be an S-strkey"),
  EVM_RPC_URL: z.string().url(),
  STELLAR_RPC_URL: z.string().url(),
  STELLAR_NETWORK_PASSPHRASE: z.string().min(1),
  SIGN_DOMAIN: z.string().optional(),
  SIGN_URI: z.string().url().optional(),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  LOCK_TIME_TO_EXPIRE_MS: z.coerce.number().int().positive().default(300_000),
  DRY_RUN: z
    .enum(["0", "1", "true", "false"])
    .default("1")
    .transform((v) => v === "1" || v === "true"),
})

export type Config = z.infer<typeof EnvSchema>

export function loadConfig(): Config {
  const parsed = EnvSchema.safeParse(process.env)
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n")
    throw new Error(`invalid env:\n${msg}`)
  }
  return parsed.data
}
