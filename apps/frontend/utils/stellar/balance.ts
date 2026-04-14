import { Horizon } from "@stellar/stellar-sdk"
import { parseUnits } from "viem"
import { defaultHorizonUrl } from "./trustline"
import type { TokenKind } from "@/types/tokens"

export interface StellarBalanceResult {
  value: bigint
  decimals: number
  symbol: string
}

interface BalanceToken {
  kind: TokenKind
  symbol: string
  decimals: number
  assetIssuer?: string | null
}

/**
 * Reads a bridger's balance on Stellar for NATIVE (XLM) and SAC tokens via
 * Horizon. SEP41 Soroban tokens aren't supported here — Horizon doesn't index
 * contract data and a Soroban RPC query is required. Returns null for
 * unsupported kinds so callers can fall back gracefully.
 */
export async function getStellarTokenBalance(
  publicKey: string,
  token: BalanceToken,
  horizonUrl: string = defaultHorizonUrl(),
): Promise<StellarBalanceResult | null> {
  const server = new Horizon.Server(horizonUrl)
  const zero: StellarBalanceResult = {
    value: BigInt(0),
    decimals: token.decimals,
    symbol: token.symbol,
  }
  try {
    const account = await server.loadAccount(publicKey)
    if (token.kind === "NATIVE") {
      const row = account.balances.find((b) => b.asset_type === "native")
      if (!row) return zero
      return {
        value: parseUnits(row.balance, token.decimals),
        decimals: token.decimals,
        symbol: token.symbol,
      }
    }
    if (token.kind === "SAC") {
      if (!token.assetIssuer) return null
      const row = account.balances.find(
        (b) =>
          (b.asset_type === "credit_alphanum4" ||
            b.asset_type === "credit_alphanum12") &&
          (b as { asset_code?: string }).asset_code === token.symbol &&
          (b as { asset_issuer?: string }).asset_issuer === token.assetIssuer,
      )
      if (!row) return zero
      return {
        value: parseUnits(row.balance, token.decimals),
        decimals: token.decimals,
        symbol: token.symbol,
      }
    }
    return null
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e !== null &&
      "response" in e &&
      (e as { response?: { status?: number } }).response?.status === 404
    ) {
      return zero
    }
    throw e
  }
}
