import { Injectable } from '@nestjs/common';
import { ChainAdapter } from './chain-adapter.abstract';
import { ViemService } from '../../providers/viem/viem.service';
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
export class EvmChainAdapter extends ChainAdapter {
  private static readonly EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
  // ECDSA signature: r(32) + s(32) + v(1) = 65 bytes → 130 hex chars.
  private static readonly EVM_SIG_RE = /^0x[a-fA-F0-9]{130}$/;

  constructor(private readonly viem: ViemService) {
    super();
  }

  // EVM addresses are 20-byte, 0x-prefixed, 40 hex chars. Reject anything
  // else at the adapter boundary so routing mistakes surface here instead
  // of as opaque ABI errors downstream.
  private assertLocalAddress(value: string, field: string): void {
    if (!EvmChainAdapter.EVM_ADDRESS_RE.test(value)) {
      throw new Error(
        `${field}: expected EVM address (0x + 40 hex), got "${value}"`,
      );
    }
  }

  private assertLocalSignature(value: string, field: string): void {
    if (!EvmChainAdapter.EVM_SIG_RE.test(value)) {
      throw new Error(
        `${field}: expected ECDSA signature (0x + 130 hex), got "${value}"`,
      );
    }
  }

  getCreateAdRequestContractDetails(
    data: T_CreateAdRequest,
  ): Promise<T_CreateAdRequestContractDetails> {
    this.assertLocalAddress(data.adContractAddress, 'adContractAddress');
    this.assertLocalAddress(data.adToken, 'adToken');
    return this.viem.getCreateAdRequestContractDetails(data);
  }

  getFundAdRequestContractDetails(
    data: T_CreatFundAdRequest,
  ): Promise<T_CreatFundAdRequestContractDetails> {
    this.assertLocalAddress(data.adContractAddress, 'adContractAddress');
    return this.viem.getFundAdRequestContractDetails(data);
  }

  getWithdrawFromAdRequestContractDetails(
    data: T_WithdrawFromAdRequest,
  ): Promise<T_WithdrawFromAdRequestContractDetails> {
    this.assertLocalAddress(data.adContractAddress, 'adContractAddress');
    this.assertLocalAddress(data.to, 'to');
    return this.viem.getWithdrawFromAdRequestContractDetails(data);
  }

  getCloseAdRequestContractDetails(
    data: T_CloseAdRequest,
  ): Promise<T_CloseAdRequestContractDetails> {
    this.assertLocalAddress(data.adContractAddress, 'adContractAddress');
    this.assertLocalAddress(data.to, 'to');
    return this.viem.getCloseAdRequestContractDetails(data);
  }

  getLockForOrderRequestContractDetails(
    data: T_LockForOrderRequest,
  ): Promise<T_LockForOrderRequestContractDetails> {
    this.assertLocalAddress(data.adContractAddress, 'adContractAddress');
    return this.viem.getLockForOrderRequestContractDetails(data);
  }

  getCreateOrderRequestContractDetails(
    data: T_CreateOrderRequest,
  ): Promise<T_CreateOrderRequestContractDetails> {
    this.assertLocalAddress(data.orderContractAddress, 'orderContractAddress');
    return this.viem.getCreateOrderRequestContractDetails(data);
  }

  getUnlockOrderContractDetails(
    data: T_CreateUnlockOrderContractDetails,
  ): Promise<T_UnlockOrderContractDetails> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.viem.getUnlockOrderContractDetails(data);
  }

  validateAdManagerRequest(data: T_RequestValidation): Promise<boolean> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.viem.validateAdManagerRequest(data);
  }

  validateOrderPortalRequest(data: T_RequestValidation): Promise<boolean> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.viem.validateOrderPortalRequest(data);
  }

  fetchOnChainLatestRoot(
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<string> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.viem.fetchOnChainLatestRoot(isAdCreator, data);
  }

  fetchAdChainLatestRoot(data: T_FetchRoot): Promise<string> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.viem.fetchAdChainLatestRoot(data);
  }

  fetchOrderChainLatestRoot(data: T_FetchRoot): Promise<string> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.viem.fetchOrderChainLatestRoot(data);
  }

  checkLocalRootExist(
    localRoot: string,
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<boolean> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.viem.checkLocalRootExist(localRoot, isAdCreator, data);
  }

  fetchOnChainRoots(
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<string[]> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.viem.fetchOnChainRoots(isAdCreator, data);
  }

  fetchAdChainRoots(data: T_FetchRoot): Promise<string[]> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.viem.fetchAdChainRoots(data);
  }

  fetchOrderChainRoots(data: T_FetchRoot): Promise<string[]> {
    this.assertLocalAddress(data.contractAddress, 'contractAddress');
    return this.viem.fetchOrderChainRoots(data);
  }

  mintToken(data: {
    chainId: string;
    tokenAddress: ChainAddress;
    receiver: ChainAddress;
  }): Promise<{ txHash: string }> {
    this.assertLocalAddress(data.tokenAddress, 'tokenAddress');
    this.assertLocalAddress(data.receiver, 'receiver');
    return this.viem.mintToken({
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
    return this.viem.checkTokenBalance({
      chainId: data.chainId,
      tokenAddress: data.tokenAddress as `0x${string}`,
      account: data.account as `0x${string}`,
    });
  }

  orderTypeHash(orderParams: T_OrderParams): string {
    return this.viem.orderTypeHash(orderParams);
  }

  verifyOrderSignature(
    address: ChainAddress,
    orderHash: `0x${string}`,
    signature: string,
  ): boolean {
    this.assertLocalAddress(address, 'address');
    this.assertLocalSignature(signature, 'signature');
    return this.viem.verifyOrderSignature(
      address as `0x${string}`,
      orderHash,
      signature as `0x${string}`,
    );
  }
}
