import { hashTypedData } from "viem"

export const ORDER_DOMAIN = {
  name: "Proofbridge",
  version: "1",
} as const

// Cross-chain (bytes32) Order type — matches backend-relayer's canonical
// EIP-712 definition in providers/viem/ethers/typedData.ts and the Stellar
// bridger-side hash we sign with Ed25519.
export const ORDER_TYPES_BYTES32 = {
  Order: [
    { name: "orderChainToken", type: "bytes32" },
    { name: "adChainToken", type: "bytes32" },
    { name: "amount", type: "uint256" },
    { name: "bridger", type: "bytes32" },
    { name: "orderChainId", type: "uint256" },
    { name: "orderPortal", type: "bytes32" },
    { name: "orderRecipient", type: "bytes32" },
    { name: "adChainId", type: "uint256" },
    { name: "adManager", type: "bytes32" },
    { name: "adId", type: "string" },
    { name: "adCreator", type: "bytes32" },
    { name: "adRecipient", type: "bytes32" },
    { name: "salt", type: "uint256" },
  ],
} as const

// EVM-native (address) Order type — the frontend used this shape pre-Stellar.
// Kept for the EVM-on-both-sides path where addresses are already 20 bytes.
export const ORDER_TYPES_ADDRESS = {
  Order: [
    { name: "orderChainToken", type: "address" },
    { name: "adChainToken", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "bridger", type: "address" },
    { name: "orderChainId", type: "uint256" },
    { name: "orderPortal", type: "address" },
    { name: "orderRecipient", type: "address" },
    { name: "adChainId", type: "uint256" },
    { name: "adManager", type: "address" },
    { name: "adId", type: "string" },
    { name: "adCreator", type: "address" },
    { name: "adRecipient", type: "address" },
    { name: "salt", type: "uint256" },
  ],
} as const

export interface OrderTypedMessage {
  orderChainToken: `0x${string}`
  adChainToken: `0x${string}`
  amount: bigint
  bridger: `0x${string}`
  orderChainId: bigint
  orderPortal: `0x${string}`
  orderRecipient: `0x${string}`
  adChainId: bigint
  adManager: `0x${string}`
  adId: string
  adCreator: `0x${string}`
  adRecipient: `0x${string}`
  salt: bigint
}

export function uuidToBigInt(uuid: string): bigint {
  const hex = uuid.replace(/-/g, "")
  return BigInt("0x" + hex)
}

// Inputs come off the wire as strings (uint256 fields are stringified so they
// survive JSON). Convert to bigint and normalize `salt` — which may be a UUID
// — before hashing or signing.
export function buildOrderMessage(params: {
  orderChainToken: string
  adChainToken: string
  amount: string | bigint
  bridger: string
  orderChainId: string | bigint
  orderPortal: string
  orderRecipient: string
  adChainId: string | bigint
  adManager: string
  adId: string
  adCreator: string
  adRecipient: string
  salt: string | bigint
}): OrderTypedMessage {
  const toBig = (v: string | bigint) =>
    typeof v === "bigint" ? v : BigInt(v)
  const toBigSalt = (v: string | bigint) => {
    if (typeof v === "bigint") return v
    if (v.includes("-")) return uuidToBigInt(v)
    return BigInt(v)
  }
  return {
    orderChainToken: params.orderChainToken as `0x${string}`,
    adChainToken: params.adChainToken as `0x${string}`,
    amount: toBig(params.amount),
    bridger: params.bridger as `0x${string}`,
    orderChainId: toBig(params.orderChainId),
    orderPortal: params.orderPortal as `0x${string}`,
    orderRecipient: params.orderRecipient as `0x${string}`,
    adChainId: toBig(params.adChainId),
    adManager: params.adManager as `0x${string}`,
    adId: params.adId,
    adCreator: params.adCreator as `0x${string}`,
    adRecipient: params.adRecipient as `0x${string}`,
    salt: toBigSalt(params.salt),
  }
}

// EIP-712 digest — matches ethers' TypedDataEncoder.hash output and the
// on-chain ORDER_TYPEHASH. Used for the Stellar bridger flow where we
// co-sign the digest with Ed25519 rather than ECDSA.
export function hashOrder(message: OrderTypedMessage): `0x${string}` {
  return hashTypedData({
    domain: ORDER_DOMAIN,
    types: ORDER_TYPES_BYTES32,
    primaryType: "Order",
    message,
  })
}
