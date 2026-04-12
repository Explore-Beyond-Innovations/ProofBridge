import { Injectable } from '@nestjs/common';
import { ChainAdapter } from './chain-adapter.abstract';
import { StellarService } from '../../providers/stellar/stellar.service';
import {
  ChainAddress,
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
} from '../types';

@Injectable()
export class StellarChainAdapter extends ChainAdapter {
  private static readonly HEX32_RE = /^0x[a-fA-F0-9]{64}$/;

  constructor(private readonly stellar: StellarService) {
    super();
  }

  // Stellar chain-records store addresses as the 32-byte strkey payload in
  // 0x-hex form (64 hex chars). Anything else — a short EVM-style 20-byte
  // hex, a raw G.../C... strkey — is rejected here so routing mistakes
  // don't silently reach the Soroban RPC path.
  private assertLocalAddress(value: string, field: string): void {
    if (!StellarChainAdapter.HEX32_RE.test(value)) {
      throw new Error(
        `${field}: expected Stellar address (0x + 64 hex), got "${value}"`,
      );
    }
  }

  getCreateAdRequestContractDetails(
    data: T_CreateAdRequest,
  ): Promise<T_CreateAdRequestContractDetails> {
    this.assertLocalAddress(data.adContractAddress, 'adContractAddress');
    this.assertLocalAddress(data.adToken, 'adToken');
    return this.stellar.getCreateAdRequestContractDetails(data);
  }

  getFundAdRequestContractDetails(
    data: T_CreatFundAdRequest,
  ): Promise<T_CreatFundAdRequestContractDetails> {
    this.assertLocalAddress(data.adContractAddress, 'adContractAddress');
    return this.stellar.getFundAdRequestContractDetails(data);
  }

  getWithdrawFromAdRequestContractDetails(
    data: T_WithdrawFromAdRequest,
  ): Promise<T_WithdrawFromAdRequestContractDetails> {
    this.assertLocalAddress(data.adContractAddress, 'adContractAddress');
    this.assertLocalAddress(data.to, 'to');
    return this.stellar.getWithdrawFromAdRequestContractDetails(data);
  }

  getCloseAdRequestContractDetails(
    data: T_CloseAdRequest,
  ): Promise<T_CloseAdRequestContractDetails> {
    this.assertLocalAddress(data.adContractAddress, 'adContractAddress');
    this.assertLocalAddress(data.to, 'to');
    return this.stellar.getCloseAdRequestContractDetails(data);
  }

  getLockForOrderRequestContractDetails(
    data: T_LockForOrderRequest,
  ): Promise<T_LockForOrderRequestContractDetails> {
    this.assertLocalAddress(data.adContractAddress, 'adContractAddress');
    return this.stellar.getLockForOrderRequestContractDetails(data);
  }

  getCreateOrderRequestContractDetails(
    data: T_CreateOrderRequest,
  ): Promise<T_CreateOrderRequestContractDetails> {
    this.assertLocalAddress(data.orderContractAddress, 'orderContractAddress');
    return this.stellar.getCreateOrderRequestContractDetails(data);
  }

  getUnlockOrderContractDetails(
    data: T_CreateUnlockOrderContractDetails,
  ): Promise<T_UnlockOrderContractDetails> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.stellar.getUnlockOrderContractDetails(data);
  }

  validateAdManagerRequest(data: T_RequestValidation): Promise<boolean> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.stellar.validateAdManagerRequest(data);
  }

  validateOrderPortalRequest(data: T_RequestValidation): Promise<boolean> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.stellar.validateOrderPortalRequest(data);
  }

  fetchOnChainLatestRoot(
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<string> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.stellar.fetchOnChainLatestRoot(isAdCreator, data);
  }

  fetchAdChainLatestRoot(data: T_FetchRoot): Promise<string> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.stellar.fetchAdChainLatestRoot(data);
  }

  fetchOrderChainLatestRoot(data: T_FetchRoot): Promise<string> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.stellar.fetchOrderChainLatestRoot(data);
  }

  checkLocalRootExist(
    localRoot: string,
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<boolean> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.stellar.checkLocalRootExist(localRoot, isAdCreator, data);
  }

  fetchOnChainRoots(
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<string[]> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.stellar.fetchOnChainRoots(isAdCreator, data);
  }

  fetchAdChainRoots(data: T_FetchRoot): Promise<string[]> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.stellar.fetchAdChainRoots(data);
  }

  fetchOrderChainRoots(data: T_FetchRoot): Promise<string[]> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.stellar.fetchOrderChainRoots(data);
  }

  mintToken(data: {
    chainId: string;
    tokenAddress: ChainAddress;
    receiver: ChainAddress;
  }): Promise<{ txHash: string }> {
    this.assertLocalAddress(data.tokenAddress, 'tokenAddress');
    this.assertLocalAddress(data.receiver, 'receiver');
    return this.stellar.mintToken({
      chainId: data.chainId,
      tokenAddress: data.tokenAddress as `0x${string}`,
      receiver: data.receiver as `0x${string}`,
    });
  }

  checkTokenBalance(data: {
    chainId: string;
    tokenAddress: ChainAddress;
    account: ChainAddress;
  }): Promise<string> {
    this.assertLocalAddress(data.tokenAddress, 'tokenAddress');
    this.assertLocalAddress(data.account, 'account');
    return this.stellar.checkTokenBalance({
      chainId: data.chainId,
      tokenAddress: data.tokenAddress as `0x${string}`,
      account: data.account as `0x${string}`,
    });
  }

  orderTypeHash(orderParams: T_OrderParams): string {
    return this.stellar.orderTypeHash(orderParams);
  }

  verifyOrderSignature(
    address: ChainAddress,
    orderHash: `0x${string}`,
    signature: `0x${string}`,
  ): boolean {
    this.assertLocalAddress(address, 'address');
    return this.stellar.verifyOrderSignature(
      address as `0x${string}`,
      orderHash,
      signature,
    );
  }
}
