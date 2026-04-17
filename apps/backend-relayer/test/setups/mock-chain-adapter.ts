/* eslint-disable @typescript-eslint/no-unused-vars */
import { randomBytes } from 'crypto';
import { ChainAdapter } from '../../src/chain-adapters/adapters/chain-adapter.abstract';
import {
  T_AdManagerOrderParams,
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
  T_OrderPortalParams,
  T_RequestValidation,
  T_UnlockOrderContractDetails,
  T_WithdrawFromAdRequest,
  T_WithdrawFromAdRequestContractDetails,
} from '../../src/chain-adapters/types';

const ZERO_32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const FAKE_SIG = ('0x' + 'ab'.repeat(65)) as `0x${string}`;
const ONE_HOUR_S = 3600;

function uniqueHash(): `0x${string}` {
  return ('0x' + randomBytes(32).toString('hex')) as `0x${string}`;
}

// Stub adapter used by the e2e Nest app so `create*` / `lock*` / `unlock*`
// endpoints don't try to hit a live chain RPC. Returns deterministic values
// so DB rows and response shapes can be asserted. Real on-chain correctness
// is covered by `test:integrations`.
export class MockChainAdapter extends ChainAdapter {
  private expiry(): number {
    return Math.floor(Date.now() / 1000) + ONE_HOUR_S;
  }

  getCreateAdRequestContractDetails(
    data: T_CreateAdRequest,
  ): Promise<T_CreateAdRequestContractDetails> {
    return Promise.resolve({
      chainId: data.adChainId.toString(),
      contractAddress: data.adContractAddress,
      signature: FAKE_SIG,
      authToken: ZERO_32,
      timeToExpire: this.expiry(),
      adId: data.adId,
      adToken: data.adToken,
      initialAmount: data.initialAmount,
      orderChainId: data.orderChainId.toString(),
      adRecipient: data.adRecipient,
      reqHash: uniqueHash(),
    });
  }

  getFundAdRequestContractDetails(
    data: T_CreatFundAdRequest,
  ): Promise<T_CreatFundAdRequestContractDetails> {
    return Promise.resolve({
      chainId: data.adChainId.toString(),
      contractAddress: data.adContractAddress,
      signature: FAKE_SIG,
      authToken: ZERO_32,
      timeToExpire: this.expiry(),
      adId: data.adId,
      amount: data.amount,
      reqHash: uniqueHash(),
    });
  }

  getWithdrawFromAdRequestContractDetails(
    data: T_WithdrawFromAdRequest,
  ): Promise<T_WithdrawFromAdRequestContractDetails> {
    return Promise.resolve({
      chainId: data.adChainId.toString(),
      contractAddress: data.adContractAddress,
      signature: FAKE_SIG,
      authToken: ZERO_32,
      timeToExpire: this.expiry(),
      adId: data.adId,
      amount: data.amount,
      to: data.to,
      reqHash: uniqueHash(),
    });
  }

  getCloseAdRequestContractDetails(
    data: T_CloseAdRequest,
  ): Promise<T_CloseAdRequestContractDetails> {
    return Promise.resolve({
      chainId: data.adChainId.toString(),
      contractAddress: data.adContractAddress,
      signature: FAKE_SIG,
      authToken: ZERO_32,
      timeToExpire: this.expiry(),
      adId: data.adId,
      to: data.to,
      reqHash: uniqueHash(),
    });
  }

  getLockForOrderRequestContractDetails(
    data: T_LockForOrderRequest,
  ): Promise<T_LockForOrderRequestContractDetails> {
    return Promise.resolve({
      chainId: data.adChainId.toString(),
      contractAddress: data.adContractAddress,
      signature: FAKE_SIG,
      authToken: ZERO_32,
      timeToExpire: this.expiry(),
      orderParams: toAdManagerParams(data.orderParams),
      reqHash: uniqueHash(),
      orderHash: uniqueHash(),
    });
  }

  getCreateOrderRequestContractDetails(
    data: T_CreateOrderRequest,
  ): Promise<T_CreateOrderRequestContractDetails> {
    return Promise.resolve({
      chainId: data.orderChainId.toString(),
      contractAddress: data.orderContractAddress,
      signature: FAKE_SIG,
      authToken: ZERO_32,
      timeToExpire: this.expiry(),
      orderParams: toOrderPortalParams(data.orderParams),
      orderHash: uniqueHash(),
      reqHash: uniqueHash(),
    });
  }

  getUnlockOrderContractDetails(
    data: T_CreateUnlockOrderContractDetails,
  ): Promise<T_UnlockOrderContractDetails> {
    const params = data.isAdCreator
      ? toOrderPortalParams(data.orderParams)
      : toAdManagerParams(data.orderParams);
    return Promise.resolve({
      chainId: data.chainId.toString(),
      contractAddress: data.contractAddress,
      signature: FAKE_SIG,
      authToken: ZERO_32,
      timeToExpire: this.expiry(),
      orderParams: params,
      nullifierHash: data.nullifierHash,
      targetRoot: data.targetRoot,
      proof: data.proof,
      orderHash: uniqueHash(),
      reqHash: uniqueHash(),
    });
  }

  validateAdManagerRequest(_data: T_RequestValidation): Promise<boolean> {
    return Promise.resolve(true);
  }

  validateOrderPortalRequest(_data: T_RequestValidation): Promise<boolean> {
    return Promise.resolve(true);
  }

  fetchOnChainLatestRoot(
    _isAdCreator: boolean,
    _data: T_FetchRoot,
  ): Promise<string> {
    return Promise.resolve(ZERO_32);
  }

  fetchAdChainLatestRoot(_data: T_FetchRoot): Promise<string> {
    return Promise.resolve(ZERO_32);
  }

  fetchOrderChainLatestRoot(_data: T_FetchRoot): Promise<string> {
    return Promise.resolve(ZERO_32);
  }

  checkLocalRootExist(
    _localRoot: string,
    _isAdCreator: boolean,
    _data: T_FetchRoot,
  ): Promise<boolean> {
    return Promise.resolve(true);
  }

  fetchOnChainRoots(
    _isAdCreator: boolean,
    _data: T_FetchRoot,
  ): Promise<string[]> {
    return Promise.resolve([ZERO_32]);
  }

  fetchAdChainRoots(_data: T_FetchRoot): Promise<string[]> {
    return Promise.resolve([ZERO_32]);
  }

  fetchOrderChainRoots(_data: T_FetchRoot): Promise<string[]> {
    return Promise.resolve([ZERO_32]);
  }

  mintToken(_data: {
    chainId: string;
    tokenAddress: `0x${string}`;
    receiver: `0x${string}`;
  }): Promise<{ txHash: string }> {
    return Promise.resolve({ txHash: ZERO_32 });
  }

  checkTokenBalance(_data: {
    chainId: string;
    tokenAddress: `0x${string}`;
    account: `0x${string}`;
  }): Promise<string> {
    return Promise.resolve('0');
  }

  orderTypeHash(_orderParams: T_OrderParams): string {
    return ZERO_32;
  }

  verifyOrderSignature(
    _address: `0x${string}`,
    _orderHash: `0x${string}`,
    _signature: `0x${string}`,
  ): boolean {
    return true;
  }
}

function toAdManagerParams(p: T_OrderParams): T_AdManagerOrderParams {
  return {
    orderChainToken: p.orderChainToken,
    adChainToken: p.adChainToken,
    amount: p.amount,
    bridger: p.bridger,
    orderChainId: p.orderChainId,
    srcOrderPortal: p.orderPortal,
    orderRecipient: p.orderRecipient,
    adId: p.adId,
    adCreator: p.adCreator,
    adRecipient: p.adRecipient,
    salt: p.salt,
    orderDecimals: p.orderDecimals,
    adDecimals: p.adDecimals,
  };
}

function toOrderPortalParams(p: T_OrderParams): T_OrderPortalParams {
  return {
    orderChainToken: p.orderChainToken,
    adChainToken: p.adChainToken,
    amount: p.amount,
    bridger: p.bridger,
    orderRecipient: p.orderRecipient,
    adChainId: p.adChainId,
    adManager: p.adManager,
    adId: p.adId,
    adCreator: p.adCreator,
    adRecipient: p.adRecipient,
    salt: p.salt,
    orderDecimals: p.orderDecimals,
    adDecimals: p.adDecimals,
  };
}
