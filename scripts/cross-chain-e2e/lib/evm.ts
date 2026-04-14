/**
 * EVM contract deployment and interaction helpers using ethers.js.
 * Reads compiled artifacts from contracts/evm/out/ (Foundry output).
 */

import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const ROOT_DIR = process.env.ROOT_DIR!;
const EVM_OUT = path.join(ROOT_DIR, "contracts/evm/out");

export const MANAGER_ROLE = ethers.keccak256(
  ethers.toUtf8Bytes("MANAGER_ROLE"),
);

/**
 * Local nonce counter seeded from the chain's `pending` nonce.
 *
 * Anvil + ethers race: two Wallet instances sharing a key track nonces
 * independently, and `signer.getNonce()` defaults to `latest`, so a freshly
 * created signer can reuse a nonce that's still pending from a prior wallet.
 * We seed once from `pending` and bump locally on every send, then pass the
 * resulting nonce explicitly in overrides on every tx.
 */
export class NonceTracker {
  private counter = 0;
  private initialized = false;

  constructor(private readonly signer: ethers.Wallet) {}

  async init(): Promise<void> {
    this.counter = await this.signer.getNonce("pending");
    this.initialized = true;
  }

  next(): number {
    if (!this.initialized) {
      throw new Error("NonceTracker used before init()");
    }
    return this.counter++;
  }

  /** Force-resync from chain (e.g. after an out-of-band tx). */
  async resync(): Promise<void> {
    this.counter = await this.signer.getNonce("pending");
  }
}

export interface EvmContracts {
  verifier: ethers.Contract;
  merkleManager: ethers.Contract;
  wNativeToken: ethers.Contract;
  orderPortal: ethers.Contract;
  adManager: ethers.Contract;
  testToken: ethers.Contract;
  signer: ethers.Wallet;
  nonces: NonceTracker;
  addresses: {
    verifier: string;
    merkleManager: string;
    wNativeToken: string;
    orderPortal: string;
    adManager: string;
    testToken: string;
  };
}

function loadArtifact(contractFileName: string, contractName: string) {
  const artifactPath = path.join(
    EVM_OUT,
    `${contractFileName}.sol`,
    `${contractName}.json`,
  );
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found: ${artifactPath}`);
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  return { abi: artifact.abi, bytecode: artifact.bytecode.object };
}

async function deploy(
  signer: ethers.Wallet,
  nonces: NonceTracker,
  contractFileName: string,
  contractName: string,
  args: any[] = [],
): Promise<ethers.Contract> {
  const { abi, bytecode } = loadArtifact(contractFileName, contractName);
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  console.log(`  Deploying ${contractName}...`);
  const contract = await factory.deploy(...args, { nonce: nonces.next() });
  const deployTx = contract.deploymentTransaction();
  if (deployTx) await deployTx.wait();
  const addr = await contract.getAddress();
  console.log(`  Deployed ${contractName} at ${addr}`);
  return contract as ethers.Contract;
}

/** Deploy all EVM contracts (order chain side). */
export async function deployEvmContracts(
  rpcUrl: string,
  privateKey: string,
): Promise<EvmContracts> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const admin = await signer.getAddress();
  const nonces = new NonceTracker(signer);
  await nonces.init();

  console.log(`  Deployer: ${admin}`);

  const verifier = await deploy(signer, nonces, "Verifier", "HonkVerifier");
  const merkleManager = await deploy(
    signer,
    nonces,
    "MerkleManager",
    "MerkleManager",
    [admin],
  );
  const wNativeToken = await deploy(
    signer,
    nonces,
    "wNativeToken",
    "wNativeToken",
    ["Wrapped ETH", "WETH", 18],
  );

  // Deploy test ERC20 token
  const testToken = await deploy(signer, nonces, "ERC20Mock", "ERC20Mock");

  // Deploy OrderPortal
  const orderPortal = await deploy(
    signer,
    nonces,
    "OrderPortal",
    "OrderPortal",
    [
      admin,
      await verifier.getAddress(),
      await merkleManager.getAddress(),
      await wNativeToken.getAddress(),
    ],
  );

  // Deploy AdManager alongside OrderPortal so this chain can play both roles
  // (locked liquidity ad-side + order-book taker side). Both constructors
  // share the same signature.
  const adManager = await deploy(
    signer,
    nonces,
    "AdManager",
    "AdManager",
    [
      admin,
      await verifier.getAddress(),
      await merkleManager.getAddress(),
      await wNativeToken.getAddress(),
    ],
  );

  // Grant MANAGER_ROLE to OrderPortal + AdManager on MerkleManager so both
  // can anchor/consume MMR roots.
  for (const { name, addr } of [
    { name: "OrderPortal", addr: await orderPortal.getAddress() },
    { name: "AdManager", addr: await adManager.getAddress() },
  ]) {
    console.log(`  Granting MANAGER_ROLE to ${name} on MerkleManager...`);
    const tx = await merkleManager.getFunction("grantRole")(
      MANAGER_ROLE,
      addr,
      { nonce: nonces.next() },
    );
    await tx.wait();
  }

  return {
    verifier,
    merkleManager,
    wNativeToken,
    orderPortal,
    adManager,
    testToken,
    signer,
    nonces,
    addresses: {
      verifier: await verifier.getAddress(),
      merkleManager: await merkleManager.getAddress(),
      wNativeToken: await wNativeToken.getAddress(),
      orderPortal: await orderPortal.getAddress(),
      adManager: await adManager.getAddress(),
      testToken: await testToken.getAddress(),
    },
  };
}

/** Get an ethers Contract instance from a deployed address and artifact. */
export function getContract(
  address: string,
  contractFileName: string,
  contractName: string,
  signer: ethers.Wallet,
): ethers.Contract {
  const { abi } = loadArtifact(contractFileName, contractName);
  return new ethers.Contract(address, abi, signer);
}
