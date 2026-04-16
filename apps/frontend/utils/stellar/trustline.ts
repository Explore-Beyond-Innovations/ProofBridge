import {
  Asset,
  BASE_FEE,
  Horizon,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk"
import type { StellarSignFn } from "./invoke"
import { urls } from "@/utils/urls"

const DEFAULT_TESTNET_HORIZON = "https://horizon-testnet.stellar.org"

export function defaultHorizonUrl(): string {
  return (
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL || DEFAULT_TESTNET_HORIZON
  )
}

export interface TrustlineCtx {
  horizonUrl?: string
  networkPassphrase?: string
  signerPublicKey: string
  signTransaction: StellarSignFn
}

/**
 * Returns true when the account holds a trustline for the classic asset
 * identified by (code, issuer). Native XLM is always "trusted". A missing
 * account (unfunded) is treated as no trustline.
 */
export async function hasTrustline(
  publicKey: string,
  code: string,
  issuer: string,
  horizonUrl: string = defaultHorizonUrl(),
): Promise<boolean> {
  if (code.toUpperCase() === "XLM" && !issuer) return true
  const server = new Horizon.Server(horizonUrl)
  try {
    const account = await server.loadAccount(publicKey)
    return account.balances.some(
      (b: { asset_type: string; asset_code?: string; asset_issuer?: string }) =>
        (b.asset_type === "credit_alphanum4" ||
          b.asset_type === "credit_alphanum12") &&
        b.asset_code === code &&
        b.asset_issuer === issuer,
    )
  } catch (e: unknown) {
    // Horizon returns 404 for unfunded accounts — treat as no trustline.
    if (
      typeof e === "object" &&
      e !== null &&
      "response" in e &&
      (e as { response?: { status?: number } }).response?.status === 404
    ) {
      return false
    }
    throw e
  }
}

/**
 * Builds + submits a ChangeTrust op that adds a trustline for (code, issuer)
 * on the signer's account. Returns the Horizon tx hash. No-op fast-path: call
 * `hasTrustline` first — this function will *also* succeed if the trustline
 * already exists (Stellar treats it as a limit update).
 */
export async function establishTrustline(
  ctx: TrustlineCtx,
  code: string,
  issuer: string,
): Promise<string> {
  const horizonUrl = ctx.horizonUrl ?? defaultHorizonUrl()
  const passphrase = ctx.networkPassphrase ?? urls.STELLAR_NETWORK_PASSPHRASE
  const server = new Horizon.Server(horizonUrl)
  const source = await server.loadAccount(ctx.signerPublicKey)

  const asset = new Asset(code, issuer)
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(180)
    .build()

  const signedXdr = await ctx.signTransaction(tx.toXDR(), passphrase)
  const signedTx = TransactionBuilder.fromXDR(signedXdr, passphrase)
  const result = await server.submitTransaction(signedTx)
  return result.hash
}
