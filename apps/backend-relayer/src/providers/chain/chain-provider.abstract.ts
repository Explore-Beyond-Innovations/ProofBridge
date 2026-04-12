import {
  T_CloseAdRequest,
  T_CloseAdRequestContractDetails,
  T_CreatFundAdRequest,
  T_CreatFundAdRequestContractDetails,
  T_CreateAdRequest,
  T_CreateAdRequestContractDetails,
  T_CreateOrderRequest,
  T_CreateOrderRequestContractDetails,
  T_CreateUnlockOrderContractDetails,
  T_FetchRoot,
  T_LockForOrderRequest,
  T_LockForOrderRequestContractDetails,
  T_OrderParams,
  T_RequestValidation,
  T_UnlockOrderContractDetails,
  T_WithdrawFromAdRequest,
  T_WithdrawFromAdRequestContractDetails,
} from '../viem/types';

// Chain-agnostic contract surface. Each underlying chain family (EVM via
// ViemService, Stellar via StellarService, …) implements this. ad/trade/faucet
// services never depend on a concrete implementation — they go through
// ChainProviderService.forChain(chain.kind).
export abstract class ChainProvider {
  abstract getCreateAdRequestContractDetails(
    data: T_CreateAdRequest,
  ): Promise<T_CreateAdRequestContractDetails>;

  abstract getFundAdRequestContractDetails(
    data: T_CreatFundAdRequest,
  ): Promise<T_CreatFundAdRequestContractDetails>;

  abstract getWithdrawFromAdRequestContractDetails(
    data: T_WithdrawFromAdRequest,
  ): Promise<T_WithdrawFromAdRequestContractDetails>;

  abstract getCloseAdRequestContractDetails(
    data: T_CloseAdRequest,
  ): Promise<T_CloseAdRequestContractDetails>;

  abstract getLockForOrderRequestContractDetails(
    data: T_LockForOrderRequest,
  ): Promise<T_LockForOrderRequestContractDetails>;

  abstract getCreateOrderRequestContractDetails(
    data: T_CreateOrderRequest,
  ): Promise<T_CreateOrderRequestContractDetails>;

  abstract getUnlockOrderContractDetails(
    data: T_CreateUnlockOrderContractDetails,
  ): Promise<T_UnlockOrderContractDetails>;

  abstract validateAdManagerRequest(
    data: T_RequestValidation,
  ): Promise<boolean>;

  abstract validateOrderPortalRequest(
    data: T_RequestValidation,
  ): Promise<boolean>;

  abstract fetchOnChainLatestRoot(
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<string>;

  abstract fetchAdChainLatestRoot(data: T_FetchRoot): Promise<string>;

  abstract fetchOrderChainLatestRoot(data: T_FetchRoot): Promise<string>;

  abstract checkLocalRootExist(
    localRoot: string,
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<boolean>;

  abstract fetchOnChainRoots(
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<string[]>;

  abstract fetchAdChainRoots(data: T_FetchRoot): Promise<string[]>;

  abstract fetchOrderChainRoots(data: T_FetchRoot): Promise<string[]>;

  abstract mintToken(data: {
    chainId: string;
    tokenAddress: `0x${string}`;
    receiver: `0x${string}`;
  }): Promise<{ txHash: string }>;

  abstract checkTokenBalance(data: {
    chainId: string;
    tokenAddress: `0x${string}`;
    account: `0x${string}`;
  }): Promise<string>;

  abstract orderTypeHash(orderParams: T_OrderParams): string;

  abstract verifyOrderSignature(
    address: `0x${string}`,
    orderHash: `0x${string}`,
    signature: `0x${string}`,
  ): boolean;
}
