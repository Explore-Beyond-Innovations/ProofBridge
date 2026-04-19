import { AddressLike } from './eth.js';
import {
  getAbi,
  EVM_NATIVE_TOKEN_ADDRESS,
} from '@proofbridge/evm-deploy';
import {
  T_AdManagerOrderParams,
  T_OrderPortalParams,
} from '../../../apps/backend-relayer/src/chain-adapters/types.js';
import {
  createWalletClient,
  getAddress,
  http,
  PrivateKeyAccount,
  PublicClient,
} from 'viem';

// ABIs come from the shared deploy package so we never drift from the
// addresses the deploy step wrote into the manifest.
const AD_MANAGER_ABI = getAbi('AdManager', 'AdManager');
const ORDER_PORTAL_ABI = getAbi('OrderPortal', 'OrderPortal');
const ERC20_MOCK_ABI = getAbi('MockERC20', 'MockERC20');

// Mirrors contracts/evm/src/libraries/AddressCast.sol NATIVE_TOKEN_ADDRESS.
// Kept lowercase here for the endsWith-style comparison below.
const EVM_NATIVE_SENTINEL_LOWER =
  EVM_NATIVE_TOKEN_ADDRESS.toLowerCase().replace(/^0x/, '');

/**
 * OrderParams encodes addresses as 32-byte values (left-padded for EVM). The
 * low 20 bytes match the sentinel when the order-chain token is native.
 */
export function isNativeOrderToken(orderChainToken32: string): boolean {
  return orderChainToken32.slice(-40).toLowerCase() === EVM_NATIVE_SENTINEL_LOWER;
}

export async function createAd(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  signature: `0x${string}`,
  authToken: `0x${string}`,
  timeToExpire: number,
  adId: string,
  adToken: `0x${string}`,
  fundAmount: string,
  orderChainId: string,
  adRecipient: `0x${string}`,
  adManagerAddress: string,
) {
  console.log(adManagerAddress);

  const wallet = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
    account,
  });

  const hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: adManagerAddress as AddressLike,
    abi: AD_MANAGER_ABI,
    functionName: 'createAd',
    args: [
      signature,
      authToken,
      BigInt(timeToExpire),
      adId,
      adToken,
      BigInt(fundAmount),
      BigInt(orderChainId),
      adRecipient,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `AdManager.setChain tx failed revert: ${receipt.transactionHash}`,
    );
  }

  return hash;
}

export async function fundAd(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  signature: `0x${string}`,
  authToken: `0x${string}`,
  timeToExpire: number,
  adId: string,
  amount: bigint,
  adManagerAddress: string,
) {
  const wallet = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
    account,
  });

  const hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: adManagerAddress as AddressLike,
    abi: AD_MANAGER_ABI,
    functionName: 'fundAd',
    args: [signature, authToken, BigInt(timeToExpire), adId, amount],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `AdManager.fundAd tx failed revert: ${receipt.transactionHash}`,
    );
  }

  return hash;
}

export async function withdrawAdFunds(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  signature: `0x${string}`,
  authToken: `0x${string}`,
  timeToExpire: number,
  adId: string,
  amount: bigint,
  to: `0x${string}`,
  adManagerAddress: string,
) {
  const wallet = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
    account,
  });

  const hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: adManagerAddress as AddressLike,
    abi: AD_MANAGER_ABI,
    functionName: 'withdrawFromAd',
    args: [signature, authToken, BigInt(timeToExpire), adId, amount, to],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `AdManager.withdrawFromAd tx failed revert: ${receipt.transactionHash}`,
    );
  }

  return hash;
}

export async function closeAd(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  signature: `0x${string}`,
  authToken: `0x${string}`,
  timeToExpire: number,
  adId: string,
  to: `0x${string}`,
  adManagerAddress: string,
) {
  const wallet = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
    account,
  });

  const hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: adManagerAddress as AddressLike,
    abi: AD_MANAGER_ABI,
    functionName: 'closeAd',
    args: [signature, authToken, BigInt(timeToExpire), adId, to],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `AdManager.closeAd tx failed revert: ${receipt.transactionHash}`,
    );
  }

  return hash;
}

export async function createOrder(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  signature: `0x${string}`,
  authToken: `0x${string}`,
  timeToExpire: number,
  orderParams: T_OrderPortalParams,
  orderPortalAddress: string,
) {
  const wallet = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
    account,
  });

  const amount = BigInt(orderParams.amount);
  // OrderPortal.createOrder is payable: native-token routes must forward
  // msg.value ≥ params.amount, non-native routes must omit value.
  const isNative = isNativeOrderToken(orderParams.orderChainToken);

  const hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: orderPortalAddress as AddressLike,
    abi: ORDER_PORTAL_ABI,
    functionName: 'createOrder',
    args: [
      signature,
      authToken,
      BigInt(timeToExpire),
      {
        ...orderParams,
        amount,
        adChainId: BigInt(orderParams.adChainId),
        salt: BigInt(orderParams.salt),
      },
    ],
    ...(isNative ? { value: amount } : {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `OrderPortal.createOrder tx failed revert: ${receipt.transactionHash}`,
    );
  }

  return hash;
}

export async function lockForOrder(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  signature: `0x${string}`,
  authToken: `0x${string}`,
  timeToExpire: number,
  orderParams: T_AdManagerOrderParams,
  adManagerAddress: AddressLike,
) {
  const wallet = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
    account,
  });

  if (!adManagerAddress) {
    throw new Error('adManagerAddress is undefined');
  }

  const formattedAddress = getAddress(adManagerAddress);

  const hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: formattedAddress,
    abi: AD_MANAGER_ABI,
    functionName: 'lockForOrder',
    args: [
      signature,
      authToken,
      BigInt(timeToExpire),
      {
        orderChainToken: orderParams.orderChainToken,
        adChainToken: orderParams.adChainToken,
        amount: BigInt(orderParams.amount),
        bridger: orderParams.bridger,
        orderChainId: BigInt(orderParams.orderChainId),
        srcOrderPortal: orderParams.srcOrderPortal,
        orderRecipient: orderParams.orderRecipient,
        adId: orderParams.adId,
        adCreator: orderParams.adCreator,
        adRecipient: orderParams.adRecipient,
        salt: BigInt(orderParams.salt),
      },
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `AdManager.lockForOrder tx failed revert: ${receipt.transactionHash}`,
    );
  }

  return hash;
}

export async function unlockAdChain(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  signature: `0x${string}`,
  authToken: `0x${string}`,
  timeToExpire: number,
  orderParams: T_AdManagerOrderParams,
  nullifierHash: `0x${string}`,
  targetRoot: `0x${string}`,
  proof: `0x${string}`,
  adManagerAddress: string,
) {
  const wallet = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
    account,
  });

  const hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: adManagerAddress as AddressLike,
    abi: AD_MANAGER_ABI,
    functionName: 'unlock',
    args: [
      signature,
      authToken,
      BigInt(timeToExpire),
      {
        ...orderParams,
        amount: BigInt(orderParams.amount),
        orderChainId: BigInt(orderParams.orderChainId),
        salt: BigInt(orderParams.salt),
      },
      nullifierHash,
      targetRoot,
      proof,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `AdManager.unlockOrder tx failed revert: ${receipt.transactionHash}`,
    );
  }

  return hash;
}

export async function unlockOrderChain(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  signature: `0x${string}`,
  authToken: `0x${string}`,
  timeToExpire: number,
  orderParams: T_OrderPortalParams,
  nullifierHash: `0x${string}`,
  targetRoot: `0x${string}`,
  proof: `0x${string}`,
  orderPortalAddress: string,
) {
  const wallet = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
    account,
  });

  const hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: orderPortalAddress as AddressLike,
    abi: ORDER_PORTAL_ABI,
    functionName: 'unlock',

    args: [
      signature,
      authToken,
      BigInt(timeToExpire),
      {
        ...orderParams,
        amount: BigInt(orderParams.amount),
        adChainId: BigInt(orderParams.adChainId),
        salt: BigInt(orderParams.salt),
      },
      nullifierHash,
      targetRoot,
      proof,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `OrderPortal.unlockOrder tx failed revert: ${receipt.transactionHash}`,
    );
  }

  return hash;
}

export async function mintToken(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  tokenAddress: AddressLike,
  to: AddressLike,
  amount: bigint,
) {
  const wallet = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
    account,
  });

  const hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: tokenAddress,
    abi: ERC20_MOCK_ABI,
    functionName: 'mint',
    args: [to, amount],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `ERC20Mock.mint tx failed revert: ${receipt.transactionHash}`,
    );
  }

  return hash;
}

export async function approveToken(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  tokenAddress: AddressLike,
  spender: AddressLike,
  amount: bigint,
) {
  const wallet = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
    account,
  });

  const hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: tokenAddress,
    abi: ERC20_MOCK_ABI,
    functionName: 'approve',
    args: [spender, amount],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `ERC20Mock.approve tx failed revert: ${receipt.transactionHash}`,
    );
  }

  return hash;
}
