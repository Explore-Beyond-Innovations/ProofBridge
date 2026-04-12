import { AD_MANAGER_ABI } from '../../src/providers/viem/abis/adManager.abi';
import { ORDER_PORTAL_ABI } from '../../src/providers/viem/abis/orderPortal.abi';
import { MERKLE_MANAGER_ABI } from '../../src/providers/viem/abis/merkleManager.abi';

import Erc20MockArtifact from '../../../../contracts/evm/out/ERC20Mock.sol/ERC20Mock.json';

import { ethers } from 'ethers';
import { ChainData, AddressLike } from './utils';
import {
  T_AdManagerOrderParams,
  T_OrderPortalParams,
} from '../../src/chain-adapters/types';
import {
  createWalletClient,
  getAddress,
  http,
  PrivateKeyAccount,
  PublicClient,
} from 'viem';

const DEFAULT_ADMIN_ROLE = ethers.ZeroHash as `0x${string}`;

export async function grantManagerRole(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  chain: ChainData,
) {
  const mgrAddr = account.address;

  const isAdmin = await publicClient.readContract({
    address: chain.merkleManagerAddress,
    abi: MERKLE_MANAGER_ABI,
    functionName: 'hasRole',
    args: [DEFAULT_ADMIN_ROLE, mgrAddr],
  });

  if (!isAdmin) throw new Error(`Signer ${mgrAddr} is NOT DEFAULT_ADMIN_ROLE`);

  const MANAGER_ROLE = ethers.id('MANAGER_ROLE');

  const wallet = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
    account,
  });

  let hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: chain.merkleManagerAddress,
    abi: MERKLE_MANAGER_ABI,
    functionName: 'grantRole',
    args: [MANAGER_ROLE, chain.orderPortalAddress],
  });
  let receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(`grantRole(OP) tx failed: ${receipt.transactionHash}`);
  }
  console.log('Orderportal granted');

  hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: chain.merkleManagerAddress,
    abi: MERKLE_MANAGER_ABI,
    functionName: 'grantRole',
    args: [MANAGER_ROLE, chain.adManagerAddress],
  });
  receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(`grantRole(AD) tx failed: ${receipt.transactionHash}`);
  }

  console.log('AdManager granted');
}

export async function setupAdManager(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  adChain: ChainData,
  orderChain: ChainData,
) {
  const mgrAddr = account.address;

  const wallet = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
    account,
  });

  const isAdmin = await publicClient.readContract({
    address: adChain.adManagerAddress,
    abi: AD_MANAGER_ABI,
    functionName: 'hasRole',
    args: [DEFAULT_ADMIN_ROLE, mgrAddr],
  });

  if (!isAdmin) throw new Error(`Signer ${mgrAddr} is NOT DEFAULT_ADMIN_ROLE`);

  let hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: adChain.adManagerAddress,
    abi: AD_MANAGER_ABI,
    functionName: 'setChain',
    args: [BigInt(orderChain.chainId), orderChain.orderPortalAddress, true],
  });

  let receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `AdManager.setChain tx failed revert: ${receipt.transactionHash}`,
    );
  }

  console.log('AdManager set');

  hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: adChain.adManagerAddress,
    abi: AD_MANAGER_ABI,
    functionName: 'setTokenRoute',
    args: [
      adChain.tokenAddress,
      orderChain.tokenAddress,
      BigInt(orderChain.chainId),
    ],
  });

  receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `AdManager.setChain tx failed revert: ${receipt.transactionHash}`,
    );
  }

  console.log('AdManager route set');
}

export async function setupOrderPortal(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  adChain: ChainData,
  orderChain: ChainData,
) {
  const mgrAddr = account.address;

  const wallet = createWalletClient({
    chain: publicClient.chain,
    transport: http(),
    account,
  });

  const isAdmin = await publicClient.readContract({
    address: orderChain.orderPortalAddress,
    abi: AD_MANAGER_ABI,
    functionName: 'hasRole',
    args: [DEFAULT_ADMIN_ROLE, mgrAddr],
  });

  if (!isAdmin) throw new Error(`Signer ${mgrAddr} is NOT DEFAULT_ADMIN_ROLE`);

  let hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: orderChain.orderPortalAddress,
    abi: ORDER_PORTAL_ABI,
    functionName: 'setChain',
    args: [BigInt(adChain.chainId), adChain.adManagerAddress, true],
  });

  let receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `OrderPortal.setChain tx failed revert: ${receipt.transactionHash}`,
    );
  }

  console.log('OrderPortal set');

  hash = await wallet.writeContract({
    chain: publicClient.chain,
    address: orderChain.orderPortalAddress,
    abi: ORDER_PORTAL_ABI,
    functionName: 'setTokenRoute',
    args: [
      orderChain.tokenAddress,
      BigInt(adChain.chainId),
      adChain.tokenAddress,
    ],
  });

  receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== 'success') {
    throw new Error(
      `OrderPortal.setTokenRoute tx failed revert: ${receipt.transactionHash}`,
    );
  }

  console.log('OrderPortal route set');
}

export async function adminSetup(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  chain1: ChainData,
  chain2: ChainData,
) {
  // On the same provider chain (chain 1)
  // Setup roles and contracts
  await grantManagerRole(publicClient, account, chain1);
  // chain 1 is the ad chain, chain 2 is the order chain for setupAdManager
  await setupAdManager(publicClient, account, chain1, chain2);
  // chain 2 is the ad chain, chain 1 is the order chain for setupOrderPortal
  await setupOrderPortal(publicClient, account, chain2, chain1);
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
        amount: BigInt(orderParams.amount),
        adChainId: BigInt(orderParams.adChainId),
        salt: BigInt(orderParams.salt),
      },
    ],
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
    abi: Erc20MockArtifact.abi,
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
    abi: Erc20MockArtifact.abi,
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
