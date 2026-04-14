import {
  Contract,
  Networks,
  TransactionBuilder,
  rpc,
  xdr,
} from "@stellar/stellar-sdk"
import { hex32ToContractId } from "./address"

const BASE_FEE = "1000"

export type StellarSignFn = (
  xdr: string,
  networkPassphrase?: string,
) => Promise<string>

export interface InvokeSorobanOpts {
  rpcUrl: string
  networkPassphrase?: string
  signerPublicKey: string // G-strkey of the wallet account paying the fee
  contractHex: string // 0x + 64 hex (stored contract address)
  method: string
  args: xdr.ScVal[]
  signTransaction: StellarSignFn
  pollIntervalMs?: number
  pollAttempts?: number
}

export async function invokeSoroban({
  rpcUrl,
  networkPassphrase,
  signerPublicKey,
  contractHex,
  method,
  args,
  signTransaction,
  pollIntervalMs = 1000,
  pollAttempts = 30,
}: InvokeSorobanOpts): Promise<string> {
  const passphrase = networkPassphrase ?? Networks.TESTNET
  const server = new rpc.Server(rpcUrl, {
    allowHttp: rpcUrl.startsWith("http://"),
  })
  const contract = new Contract(hex32ToContractId(contractHex))
  const source = await server.getAccount(signerPublicKey)
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build()

  const prepared = await server.prepareTransaction(tx)
  const signedXdr = await signTransaction(prepared.toXDR(), passphrase)
  const signedTx = TransactionBuilder.fromXDR(signedXdr, passphrase)

  const sent = await server.sendTransaction(signedTx)
  if (sent.status === "ERROR") {
    throw new Error(
      `Stellar send failed [${method}]: ${JSON.stringify(sent.errorResult)}`,
    )
  }

  for (let i = 0; i < pollAttempts; i++) {
    const got = await server.getTransaction(sent.hash)
    if (got.status === rpc.Api.GetTransactionStatus.SUCCESS) return sent.hash
    if (got.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Stellar tx [${method}] FAILED hash=${sent.hash}`)
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }
  throw new Error(`Stellar tx [${method}] timed out hash=${sent.hash}`)
}
