// Cross-chain bytes32 convention
// ────────────────────────────────────────────────────────────────────
// All address-like fields that cross chain boundaries are `Bytes32Hex`
// (0x-prefixed, 64 hex chars). For EVM addresses this means left-padded
// with 12 zero bytes; for Stellar addresses the full 32-byte strkey payload.
//
// Fields that stay on the ad chain itself (the AdManager contract address,
// the ad's local ERC20 `adToken`, withdraw `to`) remain 20-byte EVM
// addresses because they're only ever consumed by EVM ABI calls.

export type Bytes32Hex = `0x${string}`;
export type EvmAddress = `0x${string}`;

export type T_CreateAdRequest = {
  adContractAddress: EvmAddress;
  adChainId: bigint;
  adId: string;
  adToken: EvmAddress;
  initialAmount: string;
  orderChainId: bigint;
  adRecipient: Bytes32Hex;
};

export type T_CreateAdRequestContractDetails = {
  chainId: string;
  contractAddress: string;
  signature: `0x${string}`;
  authToken: string;
  timeToExpire: number;
  adId: string;
  adToken: EvmAddress;
  initialAmount: string;
  orderChainId: string;
  adRecipient: Bytes32Hex;
  reqHash: `0x${string}`;
};

export type T_CreatFundAdRequest = {
  adContractAddress: EvmAddress;
  adChainId: bigint;
  adId: string;
  amount: string;
};

export type T_CreatFundAdRequestContractDetails = {
  chainId: string;
  contractAddress: string;
  signature: `0x${string}`;
  authToken: string;
  timeToExpire: number;
  adId: string;
  amount: string;
  reqHash: `0x${string}`;
};

export type T_WithdrawFromAdRequest = {
  adContractAddress: EvmAddress;
  adChainId: bigint;
  adId: string;
  amount: string;
  to: EvmAddress;
};

export type T_WithdrawFromAdRequestContractDetails = {
  chainId: string;
  contractAddress: string;
  signature: `0x${string}`;
  authToken: string;
  timeToExpire: number;
  adId: string;
  amount: string;
  to: EvmAddress;
  reqHash: `0x${string}`;
};

export type T_CloseAdRequest = {
  adContractAddress: EvmAddress;
  adChainId: bigint;
  adId: string;
  to: EvmAddress;
};

export type T_CloseAdRequestContractDetails = {
  chainId: string;
  contractAddress: string;
  signature: `0x${string}`;
  authToken: string;
  timeToExpire: number;
  adId: string;
  to: EvmAddress;
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
  adContractAddress: EvmAddress;
  orderParams: T_OrderParams;
};

export type T_LockForOrderRequestContractDetails = {
  chainId: string;
  contractAddress: string;
  signature: `0x${string}`;
  authToken: string;
  timeToExpire: number;
  orderParams: T_AdManagerOrderParams;
  reqHash: `0x${string}`;
  orderHash: `0x${string}`;
};

export type T_CreateOrderRequest = {
  orderChainId: bigint;
  orderContractAddress: EvmAddress;
  orderParams: T_OrderParams;
};

export type T_CreateUnlockOrderContractDetails = {
  chainId: bigint;
  contractAddress: EvmAddress;
  isAdCreator: boolean;
  orderParams: T_OrderParams;
  nullifierHash: string;
  targetRoot: string;
  proof: string;
};

export type T_UnlockOrderContractDetails = {
  chainId: string;
  contractAddress: EvmAddress;
  signature: `0x${string}`;
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
  authToken: string;
  timeToExpire: number;
  orderParams: T_OrderPortalParams;
  orderHash: `0x${string}`;
  reqHash: `0x${string}`;
};

export type T_RequestValidation = {
  chainId: bigint;
  contractAddress: EvmAddress;
  reqHash: `0x${string}`;
};

export type T_FetchRoot = {
  chainId: bigint;
  contractAddress: EvmAddress;
};

export type T_FetchRootResponse = {
  root: string;
};
