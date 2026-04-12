/**
 * EVM contract deployment and interaction helpers using ethers.js.
 * Reads compiled artifacts from contracts/evm/out/ (Foundry output).
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const ROOT_DIR = process.env.ROOT_DIR!;
const EVM_OUT = path.join(ROOT_DIR, "contracts/evm/out");

export const MANAGER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANAGER_ROLE"));

export interface EvmContracts {
  verifier: ethers.Contract;
  merkleManager: ethers.Contract;
  wNativeToken: ethers.Contract;
  orderPortal: ethers.Contract;
  testToken: ethers.Contract;
  addresses: {
    verifier: string;
    merkleManager: string;
    wNativeToken: string;
    orderPortal: string;
    testToken: string;
  };
}

function loadArtifact(contractFileName: string, contractName: string) {
  const artifactPath = path.join(
    EVM_OUT,
    `${contractFileName}.sol`,
    `${contractName}.json`
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return { abi: artifact.abi, bytecode: artifact.bytecode.object };
}

async function deploy(
  signer: ethers.Wallet,
  contractFileName: string,
  contractName: string,
  args: any[] = []
): Promise<ethers.Contract> {
  const { abi, bytecode } = loadArtifact(contractFileName, contractName);
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  console.log(`  Deploying ${contractName}...`);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const addr = await contract.getAddress();
  console.log(`  Deployed ${contractName} at ${addr}`);
  return contract as ethers.Contract;
}

/** Deploy all EVM contracts (order chain side). */
export async function deployEvmContracts(
  rpcUrl: string,
  privateKey: string
): Promise<EvmContracts> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const admin = await signer.getAddress();

  console.log(`  Deployer: ${admin}`);

  const verifier = await deploy(signer, "Verifier", "HonkVerifier");
  const merkleManager = await deploy(signer, "MerkleManager", "MerkleManager", [admin]);
  const wNativeToken = await deploy(signer, "wNativeToken", "wNativeToken", [
    "Wrapped ETH",
    "WETH",
    18,
  ]);

  // Deploy test ERC20 token
  const testToken = await deploy(signer, "ERC20Mock", "ERC20Mock");

  // Deploy OrderPortal
  const orderPortal = await deploy(signer, "OrderPortal", "OrderPortal", [
    admin,
    await verifier.getAddress(),
    await merkleManager.getAddress(),
    await wNativeToken.getAddress(),
  ]);

  // Grant MANAGER_ROLE to OrderPortal on MerkleManager
  console.log("  Granting MANAGER_ROLE to OrderPortal on MerkleManager...");
  const tx = await merkleManager.getFunction("grantRole")(
    MANAGER_ROLE,
    await orderPortal.getAddress()
  );
  await tx.wait();

  return {
    verifier,
    merkleManager,
    wNativeToken,
    orderPortal,
    testToken,
    addresses: {
      verifier: await verifier.getAddress(),
      merkleManager: await merkleManager.getAddress(),
      wNativeToken: await wNativeToken.getAddress(),
      orderPortal: await orderPortal.getAddress(),
      testToken: await testToken.getAddress(),
    },
  };
}

/** Get an ethers Contract instance from a deployed address and artifact. */
export function getContract(
  address: string,
  contractFileName: string,
  contractName: string,
  signer: ethers.Wallet
): ethers.Contract {
  const { abi } = loadArtifact(contractFileName, contractName);
  return new ethers.Contract(address, abi, signer);
}

/** Create a signer for EVM interactions. */
export function createSigner(rpcUrl: string, privateKey: string): ethers.Wallet {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  return new ethers.Wallet(privateKey, provider);
}
