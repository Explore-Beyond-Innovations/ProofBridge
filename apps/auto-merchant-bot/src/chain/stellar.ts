import {
  Contract,
  Keypair,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk"
import { authArgs, hex32ToContractId, orderParamsScVal } from "./scval.js"
import type { LockResponse } from "../api/trades.js"

const BASE_FEE = "1000"

export interface StellarLockCtx {
  rpcUrl: string
  networkPassphrase: string
  keypair: Keypair
  pollIntervalMs?: number
  pollAttempts?: number
}

export async function stellarLockForOrder(
  ctx: StellarLockCtx,
  lock: LockResponse,
): Promise<string> {
  if (!lock.signerPublicKey) {
    throw new Error("stellar lock response missing signerPublicKey")
  }
  const server = new rpc.Server(ctx.rpcUrl, {
    allowHttp: ctx.rpcUrl.startsWith("http://"),
  })
  const contract = new Contract(hex32ToContractId(lock.contractAddress))
  const source = await server.getAccount(ctx.keypair.publicKey())

  const args = [
    ...authArgs(
      lock.signature,
      lock.signerPublicKey,
      lock.authToken,
      lock.timeToExpire,
    ),
    orderParamsScVal(lock.orderParams),
  ]

  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: ctx.networkPassphrase,
  })
    .addOperation(contract.call("lock_for_order", ...args))
    .setTimeout(60)
    .build()

  const prepared = await server.prepareTransaction(tx)
  prepared.sign(ctx.keypair)

  const sent = await server.sendTransaction(prepared)
  if (sent.status === "ERROR") {
    throw new Error(
      `stellar send failed: ${JSON.stringify(sent.errorResult)}`,
    )
  }

  const attempts = ctx.pollAttempts ?? 30
  const interval = ctx.pollIntervalMs ?? 1000
  for (let i = 0; i < attempts; i++) {
    const got = await server.getTransaction(sent.hash)
    if (got.status === rpc.Api.GetTransactionStatus.SUCCESS) return sent.hash
    if (got.status === rpc.Api.GetTransactionStatus.FAILED) {
      // resultXdr is already a base64 string — do not re-encode.
      const resultXdr =
        "resultXdr" in got && typeof got.resultXdr === "string"
          ? got.resultXdr
          : "<missing>"
      throw new Error(
        `stellar tx FAILED hash=${sent.hash} resultXdr=${resultXdr}`,
      )
    }
    await new Promise((r) => setTimeout(r, interval))
  }
  throw new Error(`stellar tx timed out hash=${sent.hash}`)
}
