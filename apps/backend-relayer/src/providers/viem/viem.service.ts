/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import {
  Chain,
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  parseEther,
  toHex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import BigNumber from 'bignumber.js';
import { randomUUID } from 'crypto';
import { getTime } from 'date-fns';
import {
  sepolia,
  hederaTestnet,
  polygonAmoy,
  optimismSepolia,
} from 'viem/chains';
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
} from '../../chain-adapters/types';
import { AD_MANAGER_ABI } from './abis/adManager.abi';
import { ORDER_PORTAL_ABI } from './abis/orderPortal.abi';
import { env } from '@libs/configs';
import {
  buildOrderParams,
  getTypedHash,
  verifyTypedData,
} from './ethers/typedData';
import { ethLocalnet, hederaLocalnet } from './ethers/localnet';
import { MOCK_ERC20_ABI } from './abis/mockERC20.abi';

@Injectable()
export class ViemService {
  private readonly MILLISECOND = 1000;
  static FIVE_MINUTES: number = 300000;
  static TEN_MINUTES: number = 600000;
  static ONE_HOUR: number = 600000 * 6;

  constructor() {}
  getClient(chainId: string): { wallet: any; client: any } {
    let chain: Chain;
    let rpc_url: string = '';

    const id = Number(chainId);

    if (id === sepolia.id) {
      chain = sepolia;
      if (env.evmRpcApiKey != '') {
        rpc_url = `https://go.getblock.io/${env.evmRpcApiKey}`;
      }
    } else if (id === hederaTestnet.id) {
      chain = hederaTestnet;
      if (env.rpcUrlHedera) {
        rpc_url = env.rpcUrlHedera;
      }
    } else if (id === ethLocalnet.id) {
      chain = ethLocalnet;
    } else if (id === hederaLocalnet.id) {
      chain = hederaLocalnet;
    } else if (id === polygonAmoy.id) {
      chain = polygonAmoy;
      if (env.evmRpcApiKey != '') {
        rpc_url = `https://polygon-mumbai.g.alchemy.com/v2/${env.evmRpcApiKey}`;
      }
    } else if (id === optimismSepolia.id) {
      chain = optimismSepolia;
      if (env.evmRpcApiKey != '') {
        rpc_url = `https://opt-sepolia.g.alchemy.com/v2/${env.evmRpcApiKey}`;
      }
    } else {
      throw new Error(`Unsupported chainId: ${chainId}`);
    }

    const adminKey = env.admin as `0x${string}`;

    if (!adminKey) {
      throw new Error(
        'Missing/invalid ADMIN_SECRET (expected 0x-prefixed 32-byte hex).',
      );
    }

    const wallet = createWalletClient({
      chain,
      transport: http(),
      account: privateKeyToAccount(adminKey),
    });

    const client = createPublicClient({
      chain,
      transport: rpc_url ? http(rpc_url) : http(),
    });

    return {
      wallet,
      client,
    };
  }
  async getCreateAdRequestContractDetails(
    data: T_CreateAdRequest,
  ): Promise<T_CreateAdRequestContractDetails> {
    const {
      adChainId,
      adContractAddress,
      adId,
      adToken,
      initialAmount,
      orderChainId,
      adRecipient,
    } = data;
    const { client, wallet } = this.getClient(adChainId.toString());
    const token: `0x${string}` = keccak256(toHex(randomUUID()));
    const timeToMilliseconds: number =
      getTime(new Date()) + ViemService.ONE_HOUR;

    const timeToExpire: string = BigNumber(timeToMilliseconds)
      .div(this.MILLISECOND)
      .toFixed(0);

    const message = await client.readContract({
      address: adContractAddress,
      abi: AD_MANAGER_ABI,
      functionName: 'createAdRequestHash',
      args: [
        adId,
        adToken,
        initialAmount,
        orderChainId,
        adRecipient,
        token,
        timeToExpire,
      ],
    });

    const signature = await wallet.signMessage({
      message: { raw: message },
    });

    return {
      chainId: adChainId.toString(),
      contractAddress: adContractAddress,
      signature,
      authToken: token,
      timeToExpire: Number(timeToExpire),
      adId,
      adToken,
      initialAmount,
      orderChainId: orderChainId.toString(),
      adRecipient,
      reqHash: message,
    };
  }

  async getFundAdRequestContractDetails(
    data: T_CreatFundAdRequest,
  ): Promise<T_CreatFundAdRequestContractDetails> {
    const { adChainId, adContractAddress, adId, amount } = data;
    const { client, wallet } = this.getClient(adChainId.toString());
    const token: `0x${string}` = keccak256(toHex(randomUUID()));

    const timeToMilliseconds: number =
      getTime(new Date()) + ViemService.FIVE_MINUTES;

    const timeToExpire: string = BigNumber(timeToMilliseconds)
      .div(this.MILLISECOND)
      .toFixed(0);

    const message = await client.readContract({
      address: adContractAddress,
      abi: AD_MANAGER_ABI,
      functionName: 'fundAdRequestHash',
      args: [adId, amount, token, timeToExpire],
    });

    const signature = await wallet.signMessage({
      message: { raw: message },
    });
    return {
      chainId: adChainId.toString(),
      contractAddress: adContractAddress,
      signature,
      authToken: token,
      timeToExpire: Number(timeToExpire),
      adId,
      amount,
      reqHash: message,
    };
  }

  async getWithdrawFromAdRequestContractDetails(
    data: T_WithdrawFromAdRequest,
  ): Promise<T_WithdrawFromAdRequestContractDetails> {
    const { adChainId, adContractAddress, adId, amount, to } = data;
    const { client, wallet } = this.getClient(adChainId.toString());
    const token: `0x${string}` = keccak256(toHex(randomUUID()));

    const timeToMilliseconds: number =
      getTime(new Date()) + ViemService.FIVE_MINUTES;

    const timeToExpire: string = BigNumber(timeToMilliseconds)
      .div(this.MILLISECOND)
      .toFixed(0);

    const message = await client.readContract({
      address: adContractAddress,
      abi: AD_MANAGER_ABI,
      functionName: 'withdrawFromAdRequestHash',
      args: [adId, amount, to, token, timeToExpire],
    });

    const signature = await wallet.signMessage({
      message: { raw: message },
    });
    return {
      chainId: adChainId.toString(),
      contractAddress: adContractAddress,
      signature,
      authToken: token,
      timeToExpire: Number(timeToExpire),
      adId,
      amount,
      to,
      reqHash: message,
    };
  }

  async getCloseAdRequestContractDetails(
    data: T_CloseAdRequest,
  ): Promise<T_CloseAdRequestContractDetails> {
    const { adChainId, adContractAddress, adId, to } = data;
    const { client, wallet } = this.getClient(adChainId.toString());
    const token: `0x${string}` = keccak256(toHex(randomUUID()));

    const timeToMilliseconds: number =
      getTime(new Date()) + ViemService.FIVE_MINUTES;

    const timeToExpire: string = BigNumber(timeToMilliseconds)
      .div(this.MILLISECOND)
      .toFixed(0);

    const message = await client.readContract({
      address: adContractAddress,
      abi: AD_MANAGER_ABI,
      functionName: 'closeAdRequestHash',
      args: [adId, to, token, timeToExpire],
    });

    const signature = await wallet.signMessage({
      message: { raw: message },
    });

    return {
      chainId: adChainId.toString(),
      contractAddress: adContractAddress,
      signature,
      authToken: token,
      timeToExpire: Number(timeToExpire),
      adId,
      to,
      reqHash: message,
    };
  }

  async getLockForOrderRequestContractDetails(
    data: T_LockForOrderRequest,
  ): Promise<T_LockForOrderRequestContractDetails> {
    const { adChainId, adContractAddress, orderParams } = data;
    const { client, wallet } = this.getClient(adChainId.toString());
    const token: `0x${string}` = keccak256(toHex(randomUUID()));

    const timeToMilliseconds: number =
      getTime(new Date()) + ViemService.TEN_MINUTES;

    const timeToExpire: string = BigNumber(timeToMilliseconds)
      .div(this.MILLISECOND)
      .toFixed(0);

    const orderHash = getTypedHash(data.orderParams);

    const message = await client.readContract({
      address: adContractAddress,
      abi: AD_MANAGER_ABI,
      functionName: 'lockForOrderRequestHash',
      args: [orderParams.adId, orderHash, token, timeToExpire],
    });

    const signature = await wallet.signMessage({
      message: { raw: message },
    });

    const params = buildOrderParams(
      orderParams,
      true,
    ) as T_AdManagerOrderParams;

    return {
      chainId: adChainId.toString(),
      contractAddress: adContractAddress,
      signature,
      authToken: token,
      timeToExpire: Number(timeToExpire),
      orderParams: params,
      reqHash: message,
      orderHash: orderHash as `0x${string}`,
    };
  }

  async getCreateOrderRequestContractDetails(
    data: T_CreateOrderRequest,
  ): Promise<T_CreateOrderRequestContractDetails> {
    const { orderChainId, orderContractAddress, orderParams } = data;
    const { client, wallet } = this.getClient(orderChainId.toString());
    const token: `0x${string}` = keccak256(toHex(randomUUID()));

    const timeToMilliseconds: number =
      getTime(new Date()) + ViemService.TEN_MINUTES;

    const timeToExpire: string = BigNumber(timeToMilliseconds)
      .div(this.MILLISECOND)
      .toFixed(0);

    const orderHash = getTypedHash(data.orderParams);

    const message = await client.readContract({
      address: orderContractAddress,
      abi: ORDER_PORTAL_ABI,
      functionName: 'createOrderRequestHash',
      args: [orderParams.adId, orderHash, token, timeToExpire],
    });

    const signature = await wallet.signMessage({
      message: { raw: message },
    });

    const params = buildOrderParams(orderParams, false) as T_OrderPortalParams;

    return {
      chainId: orderChainId.toString(),
      contractAddress: orderContractAddress,
      signature,
      authToken: token,
      timeToExpire: Number(timeToExpire),
      orderParams: params,
      reqHash: message,
      orderHash: orderHash as `0x${string}`,
    };
  }

  async validateAdManagerRequest(data: T_RequestValidation): Promise<boolean> {
    const { chainId, contractAddress, reqHash } = data;

    const { client } = this.getClient(chainId.toString());

    const recorded = await client.readContract({
      address: contractAddress,
      abi: AD_MANAGER_ABI,
      functionName: 'checkRequestHashExists',
      args: [reqHash],
    });

    if (recorded) {
      return true;
    } else {
      return false;
    }
  }

  async validateOrderPortalRequest(
    data: T_RequestValidation,
  ): Promise<boolean> {
    const { chainId, contractAddress, reqHash } = data;

    const { client } = this.getClient(chainId.toString());

    const recorded = await client.readContract({
      address: contractAddress,
      abi: ORDER_PORTAL_ABI,
      functionName: 'checkRequestHashExists',
      args: [reqHash],
    });

    if (recorded) {
      return true;
    } else {
      return false;
    }
  }

  async fetchOnChainLatestRoot(
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<string> {
    if (isAdCreator) {
      return this.fetchAdChainLatestRoot(data);
    } else {
      return this.fetchOrderChainLatestRoot(data);
    }
  }

  async fetchAdChainLatestRoot(data: T_FetchRoot): Promise<string> {
    const { chainId, contractAddress } = data;

    const { client } = this.getClient(chainId.toString());

    const root = await client.readContract({
      address: contractAddress,
      abi: AD_MANAGER_ABI,
      functionName: 'getMerkleRoot',
      args: [],
    });

    return root;
  }

  async fetchOrderChainLatestRoot(data: T_FetchRoot): Promise<string> {
    const { chainId, contractAddress } = data;

    const { client } = this.getClient(chainId.toString());

    const root = await client.readContract({
      address: contractAddress,
      abi: ORDER_PORTAL_ABI,
      functionName: 'getMerkleRoot',
      args: [],
    });

    return root;
  }

  async checkLocalRootExist(
    localRoot: string,
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<boolean> {
    console.log(data);
    const onChainRoots = await this.fetchOnChainRoots(isAdCreator, data);

    console.log(onChainRoots, localRoot);

    const formattedOnChainRoots = onChainRoots.map((root) =>
      root.toLowerCase(),
    );
    return formattedOnChainRoots.includes(localRoot.toLowerCase());
  }

  async fetchOnChainRoots(
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<string[]> {
    if (isAdCreator) {
      return this.fetchOrderChainRoots(data);
    } else {
      return this.fetchAdChainRoots(data);
    }
  }

  async fetchAdChainRoots(data: T_FetchRoot): Promise<string[]> {
    const { chainId, contractAddress } = data;
    const { client } = this.getClient(chainId.toString());

    const leafCount = await client.readContract({
      address: contractAddress,
      abi: AD_MANAGER_ABI,
      functionName: 'getMerkleLeafCount',
      args: [],
    });

    const roots: string[] = [];
    const max = Number(leafCount);

    for (let i = 1; i <= max; i++) {
      try {
        const root = await client.readContract({
          address: contractAddress,
          abi: AD_MANAGER_ABI,
          functionName: 'getHistoricalRoot',
          args: [i],
        });
        console.log('fetched root:', root);
        roots.push(root);
      } catch (err) {
        console.log(`[historicalRoot] index=${i} failed:`, err);
        // don't break, just skip
      }
    }

    return roots;
  }

  async fetchOrderChainRoots(data: T_FetchRoot): Promise<string[]> {
    const { chainId, contractAddress } = data;
    const { client } = this.getClient(chainId.toString());
    const leafCount = await client.readContract({
      address: contractAddress,
      abi: ORDER_PORTAL_ABI,
      functionName: 'getMerkleLeafCount',
      args: [],
    });

    const roots: string[] = [];
    const max = Number(leafCount);

    for (let i = 1; i <= max; i++) {
      try {
        const root = await client.readContract({
          address: contractAddress,
          abi: ORDER_PORTAL_ABI,
          functionName: 'getHistoricalRoot',
          args: [BigInt(i)],
        });
        console.log('fetched root:', root);
        roots.push(root);
      } catch (err) {
        console.warn(`[historicalRoot] index=${i} failed:`, err);
      }
    }

    return roots;
  }

  async getUnlockOrderContractDetails(
    data: T_CreateUnlockOrderContractDetails,
  ): Promise<T_UnlockOrderContractDetails> {
    const {
      chainId,
      contractAddress,
      isAdCreator,
      orderParams,
      nullifierHash,
      targetRoot,
      proof,
    } = data;

    const { client, wallet } = this.getClient(chainId.toString());
    const token: `0x${string}` = keccak256(toHex(randomUUID()));

    const timeToMilliseconds: number =
      getTime(new Date()) + ViemService.TEN_MINUTES;

    const timeToExpire: string = BigNumber(timeToMilliseconds)
      .div(this.MILLISECOND)
      .toFixed(0);

    const orderHash = getTypedHash(data.orderParams);

    const message = await client.readContract({
      address: contractAddress,
      abi: isAdCreator ? ORDER_PORTAL_ABI : AD_MANAGER_ABI,
      functionName: 'unlockOrderRequestHash',
      args: [orderParams.adId, orderHash, targetRoot, token, timeToExpire],
    });

    const signature = await wallet.signMessage({
      message: { raw: message },
    });

    const params = buildOrderParams(orderParams, !isAdCreator);

    return {
      chainId: chainId.toString(),
      contractAddress,
      signature,
      authToken: token,
      timeToExpire: Number(timeToExpire),
      orderParams: params,
      nullifierHash,
      targetRoot,
      proof,
      reqHash: message,
      orderHash: orderHash as `0x${string}`,
    };
  }

  async mintToken(data: {
    chainId: string;
    tokenAddress: `0x${string}`;
    receiver: `0x${string}`;
  }): Promise<{ txHash: string }> {
    const { chainId, tokenAddress, receiver } = data;
    const { client, wallet } = this.getClient(chainId.toString());

    const txHash = await wallet.writeContract({
      address: tokenAddress,
      abi: MOCK_ERC20_ABI,
      functionName: 'mint',
      args: [receiver, parseEther('1000000').toString()],
    });

    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
    });

    if (receipt.status != 'success') {
      throw new Error('Faucet not working');
    }

    return { txHash };
  }

  async checkTokenBalance(data: {
    chainId: string;
    tokenAddress: `0x${string}`;
    account: `0x${string}`;
  }): Promise<string> {
    const { chainId, tokenAddress, account } = data;
    const { client } = this.getClient(chainId.toString());

    const balance = await client.readContract({
      address: tokenAddress,
      abi: MOCK_ERC20_ABI,
      functionName: 'balanceOf',
      args: [account],
    });

    return balance.toString();
  }

  orderTypeHash(orderParams: T_OrderParams): string {
    return getTypedHash(orderParams);
  }

  verifyOrderSignature(
    address: `0x${string}`,
    orderHash: `0x${string}`,
    signature: `0x${string}`,
  ): boolean {
    return verifyTypedData(orderHash, signature, address);
  }
}
