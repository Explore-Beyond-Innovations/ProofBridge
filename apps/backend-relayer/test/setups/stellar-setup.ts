// Stellar deploy helper — symmetric with `deployEvmContracts()`.
// Uploads each WASM, instantiates the contracts, initialises them, and
// deploys the native XLM SAC so the test has a token route.
//
// Assumes a Stellar network is already running at STELLAR_RPC_URL with the
// admin account (STELLAR_ADMIN_SECRET) friendbot-funded. The external
// `run_cross_chain_e2e.sh` script sets both up.

import fs from 'node:fs';
import path from 'node:path';
import {
  Asset,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  hash,
  nativeToScVal,
  rpc,
  xdr,
  Address,
} from '@stellar/stellar-sdk';
import {
  accountIdToHex32,
  contractIdToHex32,
  hex32ToBuffer,
  hex32ToContractId,
} from '../../src/providers/stellar/utils/address';
import { ChainData } from './utils';

const BASE_FEE = '1000';

export interface StellarChainData {
  adManagerAddress: `0x${string}`;
  merkleManagerAddress: `0x${string}`;
  verifierAddress: `0x${string}`;
  // The native XLM SAC doubles as the ad token for this test.
  tokenAddress: `0x${string}`;
  chainId: string;
  name: string;
  tokenName: string;
  tokenSymbol: string;
  adminPublicKeyHex: `0x${string}`;
  adminSecret: string; // S… strkey, handed back so the test can sign with it
}

export const STELLAR_CHAIN_ID = '1000001';
const STELLAR_CHAIN_NAME = 'STELLAR LOCALNET';

function getServer(): rpc.Server {
  const url = process.env.STELLAR_RPC_URL;
  if (!url) throw new Error('STELLAR_RPC_URL not set');
  return new rpc.Server(url, { allowHttp: url.startsWith('http://') });
}

function networkPassphrase(): string {
  return process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
}

function loadAdminKeypair(): Keypair {
  const raw = (process.env.STELLAR_ADMIN_SECRET ?? '').trim();
  if (!raw) throw new Error('STELLAR_ADMIN_SECRET not set');
  if (StrKey.isValidEd25519SecretSeed(raw)) return Keypair.fromSecret(raw);
  if (/^0x[a-fA-F0-9]{64}$/.test(raw)) {
    return Keypair.fromRawEd25519Seed(Buffer.from(raw.slice(2), 'hex'));
  }
  throw new Error(
    'Invalid STELLAR_ADMIN_SECRET (expected S… strkey or 0x + 64 hex)',
  );
}

async function submit(
  server: rpc.Server,
  signer: Keypair,
  buildOp: () => xdr.Operation,
): Promise<rpc.Api.GetSuccessfulTransactionResponse> {
  const source = await server.getAccount(signer.publicKey());
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: networkPassphrase(),
  })
    .addOperation(buildOp())
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(signer);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'ERROR') {
    throw new Error(
      `Stellar send failed: ${JSON.stringify(sent.errorResult)}`,
    );
  }
  for (let i = 0; i < 20; i++) {
    const got = await server.getTransaction(sent.hash);
    if (got.status === rpc.Api.GetTransactionStatus.SUCCESS) return got;
    if (got.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Stellar tx FAILED hash=${sent.hash}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Stellar tx timed out hash=${sent.hash}`);
}

async function uploadWasm(
  server: rpc.Server,
  signer: Keypair,
  wasm: Buffer,
): Promise<Buffer> {
  await submit(server, signer, () => Operation.uploadContractWasm({ wasm }));
  return hash(wasm);
}

async function createContract(
  server: rpc.Server,
  signer: Keypair,
  wasmHash: Buffer,
  constructorArgs: xdr.ScVal[] = [],
): Promise<string> {
  const salt = new Uint8Array(32);
  globalThis.crypto.getRandomValues(salt);
  const res = await submit(server, signer, () =>
    Operation.createCustomContract({
      address: Address.fromString(signer.publicKey()),
      wasmHash,
      salt: Buffer.from(salt),
      constructorArgs,
    }),
  );
  const retval = res.returnValue;
  if (!retval) throw new Error('createCustomContract: no return value');
  const addr = Address.fromScAddress(retval.address()).toString();
  if (!addr.startsWith('C')) throw new Error(`unexpected contract addr: ${addr}`);
  return addr;
}

async function invoke(
  server: rpc.Server,
  signer: Keypair,
  contractIdStrkey: string,
  method: string,
  args: xdr.ScVal[],
): Promise<void> {
  await submit(server, signer, () =>
    Operation.invokeContractFunction({
      contract: contractIdStrkey,
      function: method,
      args,
    }),
  );
}

async function deployNativeSac(
  server: rpc.Server,
  signer: Keypair,
): Promise<string> {
  // If the native SAC is already deployed on this network, createStellarAssetContract
  // returns an error — fall back to the deterministic contractId.
  const asset = Asset.native();
  try {
    const res = await submit(server, signer, () =>
      Operation.createStellarAssetContract({ asset }),
    );
    const retval = res.returnValue;
    if (!retval) throw new Error('createStellarAssetContract: no return value');
    return Address.fromScAddress(retval.address()).toString();
  } catch {
    return asset.contractId(networkPassphrase());
  }
}

function wasmPath(name: string): string {
  return path.join(
    __dirname,
    '../../src/providers/stellar/wasm',
    `${name}.wasm`,
  );
}

function vkBytes(): Buffer {
  const vkPath = path.resolve(
    __dirname,
    '../../../../proof_circuits/deposits/target/vk',
  );
  if (!fs.existsSync(vkPath)) {
    throw new Error(
      `Verifier VK not found at ${vkPath}. Run scripts/build_circuits.sh first.`,
    );
  }
  return fs.readFileSync(vkPath);
}

export async function deployStellarContracts(): Promise<StellarChainData> {
  const admin = loadAdminKeypair();
  const server = getServer();
  console.log(
    `Deploying STELLAR contracts (admin=${admin.publicKey()}, rpc=${process.env.STELLAR_RPC_URL})...`,
  );

  // Upload WASMs.
  const verifierWasm = fs.readFileSync(wasmPath('verifier'));
  const merkleWasm = fs.readFileSync(wasmPath('merkle_manager'));
  const adWasm = fs.readFileSync(wasmPath('ad_manager'));
  const verifierHash = await uploadWasm(server, admin, verifierWasm);
  const merkleHash = await uploadWasm(server, admin, merkleWasm);
  const adHash = await uploadWasm(server, admin, adWasm);

  // Native XLM SAC — used as the Stellar-side ad token.
  const xlmSacStrkey = await deployNativeSac(server, admin);
  console.log(`  Native XLM SAC:  ${xlmSacStrkey}`);

  // Verifier — constructor takes the VK bytes.
  const verifierStrkey = await createContract(server, admin, verifierHash, [
    nativeToScVal(vkBytes(), { type: 'bytes' }),
  ]);
  console.log(`  Verifier:        ${verifierStrkey}`);

  // MerkleManager — initialize(admin).
  const merkleStrkey = await createContract(server, admin, merkleHash);
  await invoke(server, admin, merkleStrkey, 'initialize', [
    new Address(admin.publicKey()).toScVal(),
  ]);
  console.log(`  MerkleManager:   ${merkleStrkey}`);

  // AdManager — initialize(admin, verifier, merkle, w_native, chain_id).
  const adStrkey = await createContract(server, admin, adHash);
  await invoke(server, admin, adStrkey, 'initialize', [
    new Address(admin.publicKey()).toScVal(),
    new Address(verifierStrkey).toScVal(),
    new Address(merkleStrkey).toScVal(),
    new Address(xlmSacStrkey).toScVal(),
    nativeToScVal(BigInt(STELLAR_CHAIN_ID), { type: 'u128' }),
  ]);
  console.log(`  AdManager:       ${adStrkey}`);

  // Grant AdManager merkle_manager role so it can write roots on create/lock.
  await invoke(server, admin, merkleStrkey, 'set_manager', [
    new Address(adStrkey).toScVal(),
    xdr.ScVal.scvBool(true),
  ]);

  const contracts: StellarChainData = {
    adManagerAddress: contractIdToHex32(adStrkey),
    merkleManagerAddress: contractIdToHex32(merkleStrkey),
    verifierAddress: contractIdToHex32(verifierStrkey),
    tokenAddress: contractIdToHex32(xlmSacStrkey),
    chainId: STELLAR_CHAIN_ID,
    name: STELLAR_CHAIN_NAME,
    tokenName: 'Native XLM',
    tokenSymbol: 'XLM',
    adminPublicKeyHex: accountIdToHex32(admin.publicKey()),
    adminSecret: admin.secret(),
  };

  const filePath = path.join(__dirname, 'stellar-deployed-contracts.json');
  fs.writeFileSync(filePath, JSON.stringify(contracts, null, 2));
  console.log('Stellar contract addresses saved to:', filePath);

  return contracts;
}

// Hex-form bytes32 helpers so callers on the EVM side can pass raw addresses.
function bytes32FromEvmAddress(evmAddress: string): `0x${string}` {
  const clean = evmAddress.replace(/^0x/i, '').toLowerCase().padStart(40, '0');
  return `0x${'00'.repeat(12)}${clean}` as `0x${string}`;
}

function bytesN(hex: string) {
  return nativeToScVal(hex32ToBuffer(hex), { type: 'bytes' });
}

// Register the order chain + token route on the Stellar AdManager so orders
// from the EVM chain are accepted. Analogous to setupAdManager() on EVM.
export async function linkStellarAdManagerToOrderChain(
  stellar: StellarChainData,
  orderChain: ChainData,
): Promise<void> {
  const admin = loadAdminKeypair();
  const server = getServer();
  const adStrkey = hex32ToContractId(stellar.adManagerAddress);

  // Stellar AdManager expects bytes32 for addresses from the order chain —
  // left-pad 20-byte EVM addresses to 32 bytes.
  const orderPortalBytes32 = bytes32FromEvmAddress(orderChain.orderPortalAddress);
  const orderTokenBytes32 = bytes32FromEvmAddress(orderChain.tokenAddress);

  await invoke(server, admin, adStrkey, 'set_chain', [
    nativeToScVal(BigInt(orderChain.chainId), { type: 'u128' }),
    bytesN(orderPortalBytes32),
    xdr.ScVal.scvBool(true),
  ]);
  console.log('  Stellar AdManager.set_chain → order chain registered');

  await invoke(server, admin, adStrkey, 'set_token_route', [
    bytesN(stellar.tokenAddress),
    bytesN(orderTokenBytes32),
    nativeToScVal(BigInt(orderChain.chainId), { type: 'u128' }),
  ]);
  console.log('  Stellar AdManager.set_token_route → route set');
}
