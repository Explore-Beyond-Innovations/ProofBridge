import {
  Address,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk"
import { hex32ToContractId } from "./address"
import { urls } from "@/utils/urls"
import type { TokenKind } from "@/types/tokens"

const DEFAULT_TESTNET_RPC = "https://soroban-testnet.stellar.org"

export function defaultSorobanRpcUrl(): string {
  return process.env.NEXT_PUBLIC_STELLAR_RPC_URL || DEFAULT_TESTNET_RPC
}

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
  /**
   * 0x + 64 hex of the token's Soroban contract id. Every Stellar token in
   * the data model carries one — the wrapped-native SAC for NATIVE (XLM),
   * the classic-asset SAC for SAC, and the SEP-41 contract itself for
   * SEP41. All three expose the same `balance(addr) → i128` SEP-41-style
   * method, so balance lookups use a single read-only Soroban simulation.
   */
  address?: string | null
}

/**
 * Reads a bridger's balance on Stellar by read-only-simulating
 * `balance(addr)` against the token's Soroban contract (no signing, the
 * envelope is never submitted). Unified across NATIVE / SAC / SEP-41
 * because all three present the SEP-41 interface on their contract.
 * Returns `null` only when the token record has no contract `address`;
 * any simulation failure (unfunded account, RPC unreachable, etc.) is
 * normalized to a zero balance so the UI degrades gracefully.
 */
export async function getStellarTokenBalance(
  publicKey: string,
  token: BalanceToken,
  rpcUrl: string = defaultSorobanRpcUrl(),
): Promise<StellarBalanceResult | null> {
  if (!token.address) return null
  try {
    const value = await readContractBalance(publicKey, token.address, rpcUrl)
    return { value, decimals: token.decimals, symbol: token.symbol }
  } catch {
    return {
      value: BigInt(0),
      decimals: token.decimals,
      symbol: token.symbol,
    }
  }
}

async function readContractBalance(
  publicKey: string,
  contractHex: string,
  rpcUrl: string,
): Promise<bigint> {
  const server = new rpc.Server(rpcUrl, {
    allowHttp: rpcUrl.startsWith("http://"),
  })
  const contract = new Contract(hex32ToContractId(contractHex))
  const source = await server.getAccount(publicKey)
  const tx = new TransactionBuilder(source, {
    fee: "1000",
    networkPassphrase: urls.STELLAR_NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call("balance", Address.fromString(publicKey).toScVal()),
    )
    .setTimeout(30)
    .build()

  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error)
  }
  const success = sim as rpc.Api.SimulateTransactionSuccessResponse
  if (!success.result) throw new Error("simulation returned no result")
  const native = scValToNative(success.result.retval) as bigint | number
  return BigInt(native)
}
