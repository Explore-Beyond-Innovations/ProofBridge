// Cross-chain bytes32 convention
// ────────────────────────────────────────────────────────────────────
// All address-like fields that cross chain boundaries are `Bytes32Hex`
// (0x-prefixed, 64 hex chars). For EVM addresses this means left-padded
// with 12 zero bytes; for Stellar addresses the full 32-byte strkey payload.
//
// Local-chain address fields (adContractAddress, adToken, withdraw `to`,
// orderContractAddress) use `ChainAddress`, which is a 0x-prefixed hex
// string accepted in either the 20-byte (EVM) or 32-byte (Stellar) form.
// The chain-kind-specific adapter is responsible for validating that the
// shape matches the chain it's bound to — see `address-validators.ts`.
//
// `EvmAddress` is kept only for strictly EVM-typed values that never
// straddle chains (signatures, EIP-712 hashes).

export type Bytes32Hex = `0x${string}`;
export type EvmAddress = `0x${string}`;
// A local-chain address. 0x-prefixed hex. Either 40 hex chars (EVM, 20
// bytes) or 64 hex chars (Stellar/bytes32). The bound adapter validates
// the concrete shape.
export type ChainAddress = string;

export type T_CreateAdRequest = {
  adContractAddress: ChainAddress;
  adChainId: bigint;
  adId: string;
  adToken: ChainAddress;
  initialAmount: string;
  orderChainId: bigint;
  adRecipient: Bytes32Hex;
};

export type T_CreateAdRequestContractDetails = {
  chainId: string;
  contractAddress: string;
  signature: `0x${string}`;
  signerPublicKey?: `0x${string}`;
  authToken: string;
  timeToExpire: number;
  adId: string;
  adToken: ChainAddress;
  initialAmount: string;
  orderChainId: string;
  adRecipient: Bytes32Hex;
  reqHash: `0x${string}`;
};

export type T_CreatFundAdRequest = {
  adContractAddress: ChainAddress;
  adChainId: bigint;
  adId: string;
  amount: string;
};

export type T_CreatFundAdRequestContractDetails = {
  chainId: string;
  contractAddress: string;
  signature: `0x${string}`;
  signerPublicKey?: `0x${string}`;
  authToken: string;
  timeToExpire: number;
  adId: string;
  amount: string;
  reqHash: `0x${string}`;
};

export type T_WithdrawFromAdRequest = {
  adContractAddress: ChainAddress;
  adChainId: bigint;
  adId: string;
  amount: string;
  to: ChainAddress;
};

export type T_WithdrawFromAdRequestContractDetails = {
  chainId: string;
  contractAddress: string;
  signature: `0x${string}`;
  signerPublicKey?: `0x${string}`;
  authToken: string;
  timeToExpire: number;
  adId: string;
  amount: string;
  to: ChainAddress;
  reqHash: `0x${string}`;
};

export type T_CloseAdRequest = {
  adContractAddress: ChainAddress;
  adChainId: bigint;
  adId: string;
  to: ChainAddress;
};

export type T_CloseAdRequestContractDetails = {
  chainId: string;
  contractAddress: string;
  signature: `0x${string}`;
  signerPublicKey?: `0x${string}`;
  authToken: string;
  timeToExpire: number;
  adId: string;
  to: ChainAddress;
  reqHash: `0x${string}`;
};

// Canonical cross-chain order — matches the EIP-712 `Order` typehash in
// OrderPortal.sol and AdManager.sol. All addresses are bytes32.
export type T_OrderParams = {
  orderChainToken: Bytes32Hex;
  adChainToken: Bytes32Hex;
  amount: string;
  bridger: Bytes32Hex;
  orderChainId: string;
  orderPortal: Bytes32Hex;
  orderRecipient: Bytes32Hex;
  adChainId: string;
  adManager: Bytes32Hex;
  adId: string;
  adCreator: Bytes32Hex;
  adRecipient: Bytes32Hex;
  salt: string;
};

// Ad-chain subset passed to AdManager.lockForOrder / unlock. The local
// AdManager address + adChainId are implicit from the call site so they're
// not in the struct; `srcOrderPortal` is the remote OrderPortal bytes32.
export type T_AdManagerOrderParams = {
  orderChainToken: Bytes32Hex;
  adChainToken: Bytes32Hex;
  amount: string;
  bridger: Bytes32Hex;
  orderChainId: string;
  srcOrderPortal: Bytes32Hex;
  orderRecipient: Bytes32Hex;
  adId: string;
  adCreator: Bytes32Hex;
  adRecipient: Bytes32Hex;
  salt: string;
};

// Order-chain subset passed to OrderPortal.createOrder / unlock. The local
// OrderPortal address + orderChainId are implicit.
export type T_OrderPortalParams = {
  orderChainToken: Bytes32Hex;
  adChainToken: Bytes32Hex;
  amount: string;
  bridger: Bytes32Hex;
  orderRecipient: Bytes32Hex;
  adChainId: string;
  adManager: Bytes32Hex;
  adId: string;
  adCreator: Bytes32Hex;
  adRecipient: Bytes32Hex;
  salt: string;
};

export type T_LockForOrderRequest = {
  adChainId: bigint;
  adContractAddress: ChainAddress;
  orderParams: T_OrderParams;
};

export type T_LockForOrderRequestContractDetails = {
  chainId: string;
  contractAddress: string;
  signature: `0x${string}`;
  signerPublicKey?: `0x${string}`;
  authToken: string;
  timeToExpire: number;
  orderParams: T_AdManagerOrderParams;
  reqHash: `0x${string}`;
  orderHash: `0x${string}`;
};

export type T_CreateOrderRequest = {
  orderChainId: bigint;
  orderContractAddress: ChainAddress;
  orderParams: T_OrderParams;
};

export type T_CreateUnlockOrderContractDetails = {
  chainId: bigint;
  contractAddress: ChainAddress;
  isAdCreator: boolean;
  orderParams: T_OrderParams;
  nullifierHash: string;
  targetRoot: string;
  proof: string;
};

export type T_UnlockOrderContractDetails = {
  chainId: string;
  contractAddress: ChainAddress;
  signature: `0x${string}`;
  signerPublicKey?: `0x${string}`;
  authToken: string;
  timeToExpire: number;
  orderParams: T_AdManagerOrderParams | T_OrderPortalParams;
  nullifierHash: string;
  targetRoot: string;
  proof: string;
  orderHash: `0x${string}`;
  reqHash: `0x${string}`;
};

export type T_CreateOrderRequestContractDetails = {
  chainId: string;
  contractAddress: string;
  signature: `0x${string}`;
  signerPublicKey?: `0x${string}`;
  authToken: string;
  timeToExpire: number;
  orderParams: T_OrderPortalParams;
  orderHash: `0x${string}`;
  reqHash: `0x${string}`;
};

export type T_RequestValidation = {
  chainId: bigint;
  contractAddress: ChainAddress;
  reqHash: `0x${string}`;
};

export type T_FetchRoot = {
  chainId: bigint;
  contractAddress: ChainAddress;
};

export type T_FetchRootResponse = {
  root: string;
};
