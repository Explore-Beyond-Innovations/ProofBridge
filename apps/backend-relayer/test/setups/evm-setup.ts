import { writeFileSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

import MerkleManagerArtifact from '../../../../contracts/evm/out/MerkleManager.sol/MerkleManager.json';
import VerifierArtifact from '../../../../contracts/evm/out/Verifier.sol/HonkVerifier.json';
import AdManagerArtifact from '../../../../contracts/evm/out/AdManager.sol/AdManager.json';
import OrderPortalArtifact from '../../../../contracts/evm/out/OrderPortal.sol/OrderPortal.json';
import Erc20MockArtifact from '../../../../contracts/evm/out/ERC20Mock.sol/ERC20Mock.json';

import { createPublicClient, createWalletClient, http } from 'viem';
import { ethLocalnet } from '../../src/providers/viem/ethers/localnet';
import { AddressLike, ChainData, fundEthAddress } from './utils';
import { privateKeyToAccount } from 'viem/accounts';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

export async function deployEvmContracts(): Promise<ChainData> {
  console.log(`Deploying ETH contracts...`);

  const managerKey = process.env.MANAGER_KEY;
  if (!managerKey) {
    throw new Error('MANAGER_KEY not set in environment');
  }
  const chain = ethLocalnet;

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

  await fundEthAddress(publicClient, managerAddress, '1');
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

  const contracts: ChainData = {
    adManagerAddress,
    orderPortalAddress,
    chainId: chain.id.toString(),
    name: 'ETH LOCALNET',
    tokenName: 'ERC20Mock',
    tokenSymbol: 'E20M',
    tokenAddress: erc20Address,
    merkleManagerAddress,
    verifierAddress,
  };

  const filePath = path.join(__dirname, 'evm-deployed-contracts.json');
  writeFileSync(filePath, JSON.stringify(contracts, null, 2));
  console.log('Contract addresses saved to:', filePath);

  return contracts;
}
