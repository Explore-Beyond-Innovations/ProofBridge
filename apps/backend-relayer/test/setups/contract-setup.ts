import { writeFileSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { hederaTestnet as hederaLocalnet } from 'viem/chains';

import MerkleManagerArtifact from '../../../../contracts/evm/out/MerkleManager.sol/MerkleManager.json';
import VerifierArtifact from '../../../../contracts/evm/out/Verifier.sol/HonkVerifier.json';
import AdManagerArtifact from '../../../../contracts/evm/out/AdManager.sol/AdManager.json';
import OrderPortalArtifact from '../../../../contracts/evm/out/OrderPortal.sol/OrderPortal.json';
import Erc20MockArtifact from '../../../../contracts/evm/out/ERC20Mock.sol/ERC20Mock.json';

import { createPublicClient, createWalletClient, http } from 'viem';
import { ethLocalnet } from '../../src/providers/viem/localnet';
import { AddressLike, ChainData, fundEthAddress } from './utils';
import { adminSetup } from './contract-actions';
import { privateKeyToAccount } from 'viem/accounts';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

export async function deployContracts(isEth = true): Promise<ChainData> {
  // Log which network we're deploying to
  console.log(`Deploying ${isEth ? 'ETH' : 'HEDERA'} contracts...`);

  // Validate environment and setup chain configuration
  const managerKey = process.env.MANAGER_KEY;
  if (!managerKey) {
    throw new Error('MANAGER_KEY not set in environment');
  }
  const chain = isEth ? ethLocalnet : hederaLocalnet;

  // Initialize clients
  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  const wallet = createWalletClient({
    chain,
    transport: http(),
    account: privateKeyToAccount(managerKey as AddressLike),
  });

  const managerAddress = wallet.account.address;

  // Fund manager account if on Ethereum network
  if (isEth) {
    await fundEthAddress(publicClient, managerAddress, '1');
  }
  console.log('Using manager address:', wallet.account.address);

  // Deploy mock ERC20 token
  const hash = await wallet.deployContract({
    abi: Erc20MockArtifact.abi,
    bytecode: Erc20MockArtifact.bytecode.object as `0x${string}`,
    args: [],
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const erc20Address = receipt.contractAddress!;
  console.log('ERC20Mock deployed to:', erc20Address);

  // Deploy Verifier contract
  const txHash = await wallet.deployContract({
    abi: VerifierArtifact.abi,
    bytecode: VerifierArtifact.bytecode.object as `0x${string}`,
    args: [],
  });
  const txReceipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  const verifierAddress = txReceipt.contractAddress!;
  console.log('Verifier deployed to:', verifierAddress);

  // Deploy MerkleManager contract
  const mmHash = await wallet.deployContract({
    abi: MerkleManagerArtifact.abi,
    bytecode: MerkleManagerArtifact.bytecode.object as `0x${string}`,
    args: [managerAddress],
  });
  const mmReceipt = await publicClient.waitForTransactionReceipt({
    hash: mmHash,
  });
  const merkleManagerAddress = mmReceipt.contractAddress!;
  console.log('MerkleManager deployed to:', merkleManagerAddress);

  // Deploy AdManager contract
  const adHash = await wallet.deployContract({
    abi: AdManagerArtifact.abi,
    bytecode: AdManagerArtifact.bytecode.object as `0x${string}`,
    args: [managerAddress, verifierAddress, merkleManagerAddress],
  });
  const adReceipt = await publicClient.waitForTransactionReceipt({
    hash: adHash,
  });
  const adManagerAddress = adReceipt.contractAddress!;
  console.log('AdManager deployed to:', adManagerAddress);

  // Deploy OrderPortal contract
  const orderHash = await wallet.deployContract({
    abi: OrderPortalArtifact.abi,
    bytecode: OrderPortalArtifact.bytecode.object as `0x${string}`,
    args: [managerAddress, verifierAddress, merkleManagerAddress],
  });
  const orderReceipt = await publicClient.waitForTransactionReceipt({
    hash: orderHash,
  });
  const orderPortalAddress = orderReceipt.contractAddress!;
  console.log('OrderPortal deployed to:', orderPortalAddress);

  // Create contracts data object
  const contracts: ChainData = {
    adManagerAddress,
    orderPortalAddress,
    chainId: chain.id.toString(),
    name: isEth ? 'ETH LOCALNET' : 'HEDERA LOCALNET',
    tokenName: 'ERC20Mock',
    tokenSymbol: 'E20M',
    tokenAddress: erc20Address,
    merkleManagerAddress,
    verifierAddress,
  };

  // Save contract addresses to file
  const filePath = path.join(
    __dirname,
    isEth ? 'eth-deployed-contracts.json' : 'hedera-deployed-contracts.json',
  );
  writeFileSync(filePath, JSON.stringify(contracts, null, 2));
  console.log('Contract addresses saved to:', filePath);

  return contracts;
}

export async function setupContract(
  chain1: ChainData,
  chain2: ChainData,
  isEth = true,
) {
  const managerKey = process.env.MANAGER_KEY;

  if (!managerKey) {
    throw new Error('MANAGER_KEY not set in environment');
  }
  const chain = isEth ? ethLocalnet : hederaLocalnet;

  const publicClient = createPublicClient({
    chain,
    transport: http(),
  });

  const account = privateKeyToAccount(managerKey as AddressLike);

  await adminSetup(publicClient, account, chain1, chain2);
}

export async function setupContracts() {
  const ethContracts = await deployContracts();
  const hederaContracts = await deployContracts(false);

  console.log('Setting up ETH contracts...');

  await setupContract(ethContracts, hederaContracts);

  console.log('Setting up HEDERA contracts...');

  await setupContract(hederaContracts, ethContracts, false);

  return { ethContracts, hederaContracts };
}
