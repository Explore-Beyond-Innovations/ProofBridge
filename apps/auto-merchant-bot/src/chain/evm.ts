import { Contract, JsonRpcProvider, Wallet } from "ethers"
import { AD_MANAGER_LOCK_ABI } from "./ad-manager-abi.js"
import type { LockResponse } from "../api/trades.js"

export interface EvmLockCtx {
  rpcUrl: string
  privateKey: string
}

export async function evmLockForOrder(
  ctx: EvmLockCtx,
  lock: LockResponse,
): Promise<string> {
  const provider = new JsonRpcProvider(ctx.rpcUrl)
  const net = await provider.getNetwork()
  if (String(net.chainId) !== lock.chainId) {
    throw new Error(
      `EVM RPC chainId mismatch: provider=${net.chainId}, lock=${lock.chainId}`,
    )
  }
  const wallet = new Wallet(ctx.privateKey, provider)
  const contract = new Contract(lock.contractAddress, AD_MANAGER_LOCK_ABI, wallet)

  const params = {
    orderChainToken: lock.orderParams.orderChainToken,
    adChainToken: lock.orderParams.adChainToken,
    amount: BigInt(lock.orderParams.amount),
    bridger: lock.orderParams.bridger,
    orderChainId: BigInt(lock.orderParams.orderChainId),
    srcOrderPortal: lock.orderParams.srcOrderPortal,
    orderRecipient: lock.orderParams.orderRecipient,
    adId: lock.orderParams.adId,
    adCreator: lock.orderParams.adCreator,
    adRecipient: lock.orderParams.adRecipient,
    salt: BigInt(lock.orderParams.salt),
    orderDecimals: lock.orderParams.orderDecimals,
    adDecimals: lock.orderParams.adDecimals,
  }

  const tx = await contract.lockForOrder(
    lock.signature,
    lock.authToken,
    BigInt(lock.timeToExpire),
    params,
  )
  const receipt = await tx.wait()
  if (!receipt || receipt.status !== 1) {
    throw new Error(`lockForOrder reverted (tx=${tx.hash})`)
  }
  return receipt.hash
}
