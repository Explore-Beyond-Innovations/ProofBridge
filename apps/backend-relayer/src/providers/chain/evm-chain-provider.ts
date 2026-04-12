import { Injectable } from '@nestjs/common';
import { ChainProvider } from './chain-provider.abstract';
import { ViemService } from '../viem/viem.service';
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

@Injectable()
export class EvmChainProvider extends ChainProvider {
  constructor(private readonly viem: ViemService) {
    super();
  }

  getCreateAdRequestContractDetails(
    data: T_CreateAdRequest,
  ): Promise<T_CreateAdRequestContractDetails> {
    return this.viem.getCreateAdRequestContractDetails(data);
  }

  getFundAdRequestContractDetails(
    data: T_CreatFundAdRequest,
  ): Promise<T_CreatFundAdRequestContractDetails> {
    return this.viem.getFundAdRequestContractDetails(data);
  }

  getWithdrawFromAdRequestContractDetails(
    data: T_WithdrawFromAdRequest,
  ): Promise<T_WithdrawFromAdRequestContractDetails> {
    return this.viem.getWithdrawFromAdRequestContractDetails(data);
  }

  getCloseAdRequestContractDetails(
    data: T_CloseAdRequest,
  ): Promise<T_CloseAdRequestContractDetails> {
    return this.viem.getCloseAdRequestContractDetails(data);
  }

  getLockForOrderRequestContractDetails(
    data: T_LockForOrderRequest,
  ): Promise<T_LockForOrderRequestContractDetails> {
    return this.viem.getLockForOrderRequestContractDetails(data);
  }

  getCreateOrderRequestContractDetails(
    data: T_CreateOrderRequest,
  ): Promise<T_CreateOrderRequestContractDetails> {
    return this.viem.getCreateOrderRequestContractDetails(data);
  }

  getUnlockOrderContractDetails(
    data: T_CreateUnlockOrderContractDetails,
  ): Promise<T_UnlockOrderContractDetails> {
    return this.viem.getUnlockOrderContractDetails(data);
  }

  validateAdManagerRequest(data: T_RequestValidation): Promise<boolean> {
    return this.viem.validateAdManagerRequest(data);
  }

  validateOrderPortalRequest(data: T_RequestValidation): Promise<boolean> {
    return this.viem.validateOrderPortalRequest(data);
  }

  fetchOnChainLatestRoot(
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<string> {
    return this.viem.fetchOnChainLatestRoot(isAdCreator, data);
  }

  fetchAdChainLatestRoot(data: T_FetchRoot): Promise<string> {
    return this.viem.fetchAdChainLatestRoot(data);
  }

  fetchOrderChainLatestRoot(data: T_FetchRoot): Promise<string> {
    return this.viem.fetchOrderChainLatestRoot(data);
  }

  checkLocalRootExist(
    localRoot: string,
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<boolean> {
    return this.viem.checkLocalRootExist(localRoot, isAdCreator, data);
  }

  fetchOnChainRoots(
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<string[]> {
    return this.viem.fetchOnChainRoots(isAdCreator, data);
  }

  fetchAdChainRoots(data: T_FetchRoot): Promise<string[]> {
    return this.viem.fetchAdChainRoots(data);
  }

  fetchOrderChainRoots(data: T_FetchRoot): Promise<string[]> {
    return this.viem.fetchOrderChainRoots(data);
  }

  mintToken(data: {
    chainId: string;
    tokenAddress: `0x${string}`;
    receiver: `0x${string}`;
  }): Promise<{ txHash: string }> {
    return this.viem.mintToken(data);
  }

  checkTokenBalance(data: {
    chainId: string;
    tokenAddress: `0x${string}`;
    account: `0x${string}`;
  }): Promise<string> {
    return this.viem.checkTokenBalance(data);
  }

  orderTypeHash(orderParams: T_OrderParams): string {
    return this.viem.orderTypeHash(orderParams);
  }

  verifyOrderSignature(
    address: `0x${string}`,
    orderHash: `0x${string}`,
    signature: `0x${string}`,
  ): boolean {
    return this.viem.verifyOrderSignature(address, orderHash, signature);
  }
}
