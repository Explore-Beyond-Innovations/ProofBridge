import * as fs from 'fs';
import * as path from 'path';

import { ethers } from 'ethers';
import { EthChainData, AddressLike } from './eth.js';

// Same pattern as scripts/cross-chain-e2e/lib/evm.ts — read Foundry output at
// runtime from $ROOT_DIR/contracts/evm/out.
const ROOT_DIR = process.env.ROOT_DIR!;
const EVM_OUT = path.join(ROOT_DIR ?? '', 'contracts/evm/out');

function loadArtifact(contractFileName: string, contractName: string) {
  const artifactPath = path.join(
    EVM_OUT,
    `${contractFileName}.sol`,
    `${contractName}.json`,
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return { abi: artifact.abi, bytecode: artifact.bytecode.object };
}

const AD_MANAGER_ABI = loadArtifact('AdManager', 'AdManager').abi;
const ORDER_PORTAL_ABI = loadArtifact('OrderPortal', 'OrderPortal').abi;
const MERKLE_MANAGER_ABI = loadArtifact('MerkleManager', 'MerkleManager').abi;
const ERC20_MOCK_ABI = loadArtifact('MockERC20', 'MockERC20').abi;
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

const DEFAULT_ADMIN_ROLE = ethers.ZeroHash as `0x${string}`;

export async function grantManagerRole(
  publicClient: PublicClient,
  account: PrivateKeyAccount,
  chain: EthChainData,
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
  adChain: EthChainData,
  orderChain: EthChainData,
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
  adChain: EthChainData,
  orderChain: EthChainData,
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
  chain1: EthChainData,
  chain2: EthChainData,
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
