// Stellar contract-action helpers — Soroban analogue of contract-actions.ts.
//
// Each wrapper takes the relayer's signed-request payload (signature + signer
// public key + authToken + timeToExpire) plus the raw contract args, builds a
// Soroban invocation, prepares + signs + submits, and polls for success.

import {
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from '@stellar/stellar-sdk';
import { hex32ToBuffer, hex32ToContractId } from '../../src/providers/stellar/utils/address';

const BASE_FEE = '1000';

function getServer(): rpc.Server {
  const url = process.env.STELLAR_RPC_URL;
  if (!url) throw new Error('STELLAR_RPC_URL not set');
  return new rpc.Server(url, { allowHttp: url.startsWith('http://') });
}

function passphrase(): string {
  return process.env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET;
}

async function invoke(
  signer: Keypair,
  contractHex: string,
  method: string,
  args: xdr.ScVal[],
): Promise<string> {
  const server = getServer();
  const contract = new Contract(hex32ToContractId(contractHex));
  const source = await server.getAccount(signer.publicKey());
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: passphrase(),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(signer);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'ERROR') {
    throw new Error(
      `Stellar send failed [${method}]: ${JSON.stringify(sent.errorResult)}`,
    );
  }
  for (let i = 0; i < 20; i++) {
    const got = await server.getTransaction(sent.hash);
    if (got.status === rpc.Api.GetTransactionStatus.SUCCESS) return sent.hash;
    if (got.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Stellar tx [${method}] FAILED hash=${sent.hash}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Stellar tx [${method}] timed out hash=${sent.hash}`);
}

// ── scval helpers ───────────────────────────────────────────────────

function bytesN(hex: string): xdr.ScVal {
  return nativeToScVal(hex32ToBuffer(hex), { type: 'bytes' });
}

function bytes(buf: Buffer): xdr.ScVal {
  return nativeToScVal(buf, { type: 'bytes' });
}

function u64(n: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(n), { type: 'u64' });
}

function u128(n: string | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(n), { type: 'u128' });
}

function strVal(s: string): xdr.ScVal {
  return nativeToScVal(s, { type: 'string' });
}

// Shared auth quadruple (signature, public_key, auth_token, time_to_expire).
function authArgs(
  signatureHex: string,
  publicKeyHex: string,
  authTokenHex: string,
  timeToExpire: number,
): xdr.ScVal[] {
  return [
    bytes(Buffer.from(signatureHex.replace(/^0x/, ''), 'hex')),
    bytesN(publicKeyHex),
    bytesN(authTokenHex),
    u64(timeToExpire),
  ];
}

// ── ad-manager wrappers ─────────────────────────────────────────────

export async function createAdSoroban(
  signer: Keypair,
  signatureHex: string,
  signerPublicKeyHex: string,
  authTokenHex: string,
  timeToExpire: number,
  creatorPublicKey: string, // G-strkey of the ad creator (signer)
  adId: string,
  adTokenHex: string,
  initialAmount: string,
  orderChainId: string,
  adRecipientHex: string,
  adManagerHex: string,
): Promise<string> {
  const args = [
    ...authArgs(signatureHex, signerPublicKeyHex, authTokenHex, timeToExpire),
    new Address(creatorPublicKey).toScVal(),
    strVal(adId),
    bytesN(adTokenHex),
    u128(initialAmount),
    u128(orderChainId),
    bytesN(adRecipientHex),
  ];
  return invoke(signer, adManagerHex, 'create_ad', args);
}

export async function fundAdSoroban(
  signer: Keypair,
  signatureHex: string,
  signerPublicKeyHex: string,
  authTokenHex: string,
  timeToExpire: number,
  adId: string,
  amount: string,
  adManagerHex: string,
): Promise<string> {
  const args = [
    ...authArgs(signatureHex, signerPublicKeyHex, authTokenHex, timeToExpire),
    strVal(adId),
    u128(amount),
  ];
  return invoke(signer, adManagerHex, 'fund_ad', args);
}

export async function withdrawFromAdSoroban(
  signer: Keypair,
  signatureHex: string,
  signerPublicKeyHex: string,
  authTokenHex: string,
  timeToExpire: number,
  adId: string,
  amount: string,
  toPublicKey: string, // G-strkey
  adManagerHex: string,
): Promise<string> {
  const args = [
    ...authArgs(signatureHex, signerPublicKeyHex, authTokenHex, timeToExpire),
    strVal(adId),
    u128(amount),
    new Address(toPublicKey).toScVal(),
  ];
  return invoke(signer, adManagerHex, 'withdraw_from_ad', args);
}

export async function closeAdSoroban(
  signer: Keypair,
  signatureHex: string,
  signerPublicKeyHex: string,
  authTokenHex: string,
  timeToExpire: number,
  adId: string,
  toPublicKey: string, // G-strkey
  adManagerHex: string,
): Promise<string> {
  const args = [
    ...authArgs(signatureHex, signerPublicKeyHex, authTokenHex, timeToExpire),
    strVal(adId),
    new Address(toPublicKey).toScVal(),
  ];
  return invoke(signer, adManagerHex, 'close_ad', args);
}

// Matches contracts/stellar/contracts/ad-manager/src/types.rs::OrderParams.
export interface StellarOrderParams {
  orderChainToken: string; // 0x + 64 hex
  adChainToken: string;
  amount: string;
  bridger: string;
  orderChainId: string;
  srcOrderPortal: string;
  orderRecipient: string;
  adId: string;
  adCreator: string;
  adRecipient: string;
  salt: string;
}

function orderParamsScVal(p: StellarOrderParams): xdr.ScVal {
  // Soroban struct is encoded as an ScMap with entries sorted by key.
  const entries: Array<[string, xdr.ScVal]> = [
    ['ad_chain_token', bytesN(p.adChainToken)],
    ['ad_creator', bytesN(p.adCreator)],
    ['ad_id', strVal(p.adId)],
    ['ad_recipient', bytesN(p.adRecipient)],
    ['amount', u128(p.amount)],
    ['bridger', bytesN(p.bridger)],
    ['order_chain_id', u128(p.orderChainId)],
    ['order_chain_token', bytesN(p.orderChainToken)],
    ['order_recipient', bytesN(p.orderRecipient)],
    ['salt', u128(p.salt)],
    ['src_order_portal', bytesN(p.srcOrderPortal)],
  ];
  return xdr.ScVal.scvMap(
    entries.map(([k, v]) =>
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(k), val: v }),
    ),
  );
}

export async function lockForOrderSoroban(
  signer: Keypair,
  signatureHex: string,
  signerPublicKeyHex: string,
  authTokenHex: string,
  timeToExpire: number,
  params: StellarOrderParams,
  adManagerHex: string,
): Promise<string> {
  const args = [
    ...authArgs(signatureHex, signerPublicKeyHex, authTokenHex, timeToExpire),
    orderParamsScVal(params),
  ];
  return invoke(signer, adManagerHex, 'lock_for_order', args);
}

export async function unlockSoroban(
  signer: Keypair,
  signatureHex: string,
  signerPublicKeyHex: string,
  authTokenHex: string,
  timeToExpire: number,
  params: StellarOrderParams,
  nullifierHashHex: string,
  targetRootHex: string,
  proof: Buffer,
  adManagerHex: string,
): Promise<string> {
  const args = [
    ...authArgs(signatureHex, signerPublicKeyHex, authTokenHex, timeToExpire),
    orderParamsScVal(params),
    bytesN(nullifierHashHex),
    bytesN(targetRootHex),
    bytes(proof),
  ];
  return invoke(signer, adManagerHex, 'unlock', args);
}
