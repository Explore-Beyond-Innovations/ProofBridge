// StellarService — Soroban counterpart to ViemService. Produces presigned
// manager blobs for AdManager / OrderPortal on Stellar (ed25519 over the same
// keccak256 request-hash layout the contracts compute in `verify_request`)
// and handles read/write RPC against Soroban contracts.

import { Injectable } from '@nestjs/common';
import {
  Address,
  Contract,
  Keypair,
  Networks,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from '@stellar/stellar-sdk';
import BigNumber from 'bignumber.js';
import { getTime } from 'date-fns';
import { env } from '@libs/configs';
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
import { buildOrderParams } from '../viem/ethers/typedData';
import {
  closeAdRequestHash,
  createAdRequestHash,
  createOrderRequestHash,
  ed25519PublicKey,
  fundAdRequestHash,
  lockForOrderRequestHash,
  randomAuthToken,
  signEd25519,
  stellarSignedMessageDigest,
  unlockOrderRequestHash,
  verifyEd25519,
  withdrawFromAdRequestHash,
} from './utils/signing';
import {
  bufferToHex32,
  hex32ToBuffer,
  hex32ToContractId,
} from './utils/address';
import { computeOrderHash } from './utils/eip712';
import { buildStellarUnlockMessage } from './utils/unlock-message';

const MILLISECOND = 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const DEFAULT_BASE_FEE = '1000';

type ManagerSigner = {
  seed: Buffer;
  publicKey: Buffer;
  keypair: Keypair;
};

@Injectable()
export class StellarService {
  private signerCache: ManagerSigner | null = null;

  private getServer(): rpc.Server {
    return new rpc.Server(env.stellar.rpcUrl, {
      allowHttp: env.stellar.rpcUrl.startsWith('http://'),
    });
  }

  private networkPassphrase(): string {
    return env.stellar.networkPassphrase || Networks.TESTNET;
  }

  private getSigner(): ManagerSigner {
    if (this.signerCache) return this.signerCache;
    if (!env.stellar.adminSecret) {
      throw new Error(
        'Missing STELLAR_ADMIN_SECRET (expected S… strkey or 32-byte hex)',
      );
    }
    const raw = env.stellar.adminSecret.trim();
    let seed: Buffer;
    if (StrKey.isValidEd25519SecretSeed(raw)) {
      seed = Buffer.from(StrKey.decodeEd25519SecretSeed(raw));
    } else if (/^0x[a-fA-F0-9]{64}$/.test(raw)) {
      seed = Buffer.from(raw.slice(2), 'hex');
    } else {
      throw new Error(
        'Invalid STELLAR_ADMIN_SECRET format (want S… strkey or 0x-prefixed 32-byte hex)',
      );
    }
    const publicKey = ed25519PublicKey(seed);
    const keypair = Keypair.fromRawEd25519Seed(seed);
    this.signerCache = { seed, publicKey, keypair };
    return this.signerCache;
  }

  private sign(message: Buffer): {
    signature: `0x${string}`;
    signerPublicKey: `0x${string}`;
  } {
    const signer = this.getSigner();
    const sig = signEd25519(message, signer.seed);

    return {
      signature: `0x${sig.toString('hex')}`,
      signerPublicKey: `0x${signer.publicKey.toString('hex')}`,
    };
  }

  private nextExpiry(horizonMs: number): {
    authToken: Buffer;
    timeToExpireSec: bigint;
    timeToExpireNum: number;
  } {
    const authToken = randomAuthToken();
    const timeMs = getTime(new Date()) + horizonMs;
    const timeToExpire = BigNumber(timeMs).div(MILLISECOND).toFixed(0);
    return {
      authToken,
      timeToExpireSec: BigInt(timeToExpire),
      timeToExpireNum: Number(timeToExpire),
    };
  }

  // ── presigned requests ──────────────────────────────────────────────

  getCreateAdRequestContractDetails(
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
    const { authToken, timeToExpireSec, timeToExpireNum } =
      this.nextExpiry(ONE_HOUR_MS);
    const message = createAdRequestHash({
      authToken,
      timeToExpire: timeToExpireSec,
      adId,
      adToken: hex32ToBuffer(adToken),
      amount: BigInt(initialAmount),
      orderChainId: BigInt(orderChainId),
      adRecipient: hex32ToBuffer(adRecipient),
      chainId: BigInt(adChainId),
      contractAddress: hex32ToBuffer(adContractAddress),
    });
    const { signature, signerPublicKey } = this.sign(message);

    return Promise.resolve({
      chainId: adChainId.toString(),
      contractAddress: adContractAddress,
      signature,
      signerPublicKey,
      authToken: `0x${authToken.toString('hex')}`,
      timeToExpire: timeToExpireNum,
      adId,
      adToken,
      initialAmount,
      orderChainId: orderChainId.toString(),
      adRecipient,
      reqHash: bufferToHex32(message),
    });
  }

  getFundAdRequestContractDetails(
    data: T_CreatFundAdRequest,
  ): Promise<T_CreatFundAdRequestContractDetails> {
    const { adChainId, adContractAddress, adId, amount } = data;
    const { authToken, timeToExpireSec, timeToExpireNum } =
      this.nextExpiry(FIVE_MINUTES_MS);
    const message = fundAdRequestHash({
      authToken,
      timeToExpire: timeToExpireSec,
      adId,
      amount: BigInt(amount),
      chainId: BigInt(adChainId),
      contractAddress: hex32ToBuffer(adContractAddress),
    });
    const { signature, signerPublicKey } = this.sign(message);
    return Promise.resolve({
      chainId: adChainId.toString(),
      contractAddress: adContractAddress,
      signature,
      signerPublicKey,
      authToken: `0x${authToken.toString('hex')}`,
      timeToExpire: timeToExpireNum,
      adId,
      amount,
      reqHash: bufferToHex32(message),
    });
  }

  getWithdrawFromAdRequestContractDetails(
    data: T_WithdrawFromAdRequest,
  ): Promise<T_WithdrawFromAdRequestContractDetails> {
    const { adChainId, adContractAddress, adId, amount, to } = data;
    const { authToken, timeToExpireSec, timeToExpireNum } =
      this.nextExpiry(FIVE_MINUTES_MS);
    const message = withdrawFromAdRequestHash({
      authToken,
      timeToExpire: timeToExpireSec,
      adId,
      amount: BigInt(amount),
      to: hex32ToBuffer(to),
      chainId: BigInt(adChainId),
      contractAddress: hex32ToBuffer(adContractAddress),
    });
    const { signature, signerPublicKey } = this.sign(message);
    return Promise.resolve({
      chainId: adChainId.toString(),
      contractAddress: adContractAddress,
      signature,
      signerPublicKey,
      authToken: `0x${authToken.toString('hex')}`,
      timeToExpire: timeToExpireNum,
      adId,
      amount,
      to,
      reqHash: bufferToHex32(message),
    });
  }

  getCloseAdRequestContractDetails(
    data: T_CloseAdRequest,
  ): Promise<T_CloseAdRequestContractDetails> {
    const { adChainId, adContractAddress, adId, to } = data;
    const { authToken, timeToExpireSec, timeToExpireNum } =
      this.nextExpiry(FIVE_MINUTES_MS);
    const message = closeAdRequestHash({
      authToken,
      timeToExpire: timeToExpireSec,
      adId,
      to: hex32ToBuffer(to),
      chainId: BigInt(adChainId),
      contractAddress: hex32ToBuffer(adContractAddress),
    });
    const { signature, signerPublicKey } = this.sign(message);
    return Promise.resolve({
      chainId: adChainId.toString(),
      contractAddress: adContractAddress,
      signature,
      signerPublicKey,
      authToken: `0x${authToken.toString('hex')}`,
      timeToExpire: timeToExpireNum,
      adId,
      to,
      reqHash: bufferToHex32(message),
    });
  }

  getLockForOrderRequestContractDetails(
    data: T_LockForOrderRequest,
  ): Promise<T_LockForOrderRequestContractDetails> {
    const { adChainId, adContractAddress, orderParams } = data;
    const { authToken, timeToExpireSec, timeToExpireNum } =
      this.nextExpiry(TEN_MINUTES_MS);
    const orderHash = computeOrderHash(orderParams);
    const message = lockForOrderRequestHash({
      authToken,
      timeToExpire: timeToExpireSec,
      adId: orderParams.adId,
      orderHash: hex32ToBuffer(orderHash),
      chainId: BigInt(adChainId),
      contractAddress: hex32ToBuffer(adContractAddress),
    });
    const { signature, signerPublicKey } = this.sign(message);
    const params = buildOrderParams(
      orderParams,
      true,
    ) as T_AdManagerOrderParams;
    return Promise.resolve({
      chainId: adChainId.toString(),
      contractAddress: adContractAddress,
      signature,
      signerPublicKey,
      authToken: `0x${authToken.toString('hex')}`,
      timeToExpire: timeToExpireNum,
      orderParams: params,
      reqHash: bufferToHex32(message),
      orderHash,
    });
  }

  getCreateOrderRequestContractDetails(
    data: T_CreateOrderRequest,
  ): Promise<T_CreateOrderRequestContractDetails> {
    const { orderChainId, orderContractAddress, orderParams } = data;
    const { authToken, timeToExpireSec, timeToExpireNum } =
      this.nextExpiry(TEN_MINUTES_MS);
    const orderHash = computeOrderHash(orderParams);
    const message = createOrderRequestHash({
      authToken,
      timeToExpire: timeToExpireSec,
      adId: orderParams.adId,
      orderHash: hex32ToBuffer(orderHash),
      chainId: BigInt(orderChainId),
      contractAddress: hex32ToBuffer(orderContractAddress),
    });
    const { signature, signerPublicKey } = this.sign(message);
    const params = buildOrderParams(orderParams, false) as T_OrderPortalParams;
    return Promise.resolve({
      chainId: orderChainId.toString(),
      contractAddress: orderContractAddress,
      signature,
      signerPublicKey,
      authToken: `0x${authToken.toString('hex')}`,
      timeToExpire: timeToExpireNum,
      orderParams: params,
      reqHash: bufferToHex32(message),
      orderHash,
    });
  }

  getUnlockOrderContractDetails(
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
    const { authToken, timeToExpireSec, timeToExpireNum } =
      this.nextExpiry(TEN_MINUTES_MS);
    const orderHash = computeOrderHash(orderParams);
    const message = unlockOrderRequestHash({
      authToken,
      timeToExpire: timeToExpireSec,
      adId: orderParams.adId,
      orderHash: hex32ToBuffer(orderHash),
      targetRoot: hex32ToBuffer(targetRoot),
      chainId: BigInt(chainId),
      contractAddress: hex32ToBuffer(contractAddress),
    });
    const { signature, signerPublicKey } = this.sign(message);
    const params = buildOrderParams(orderParams, !isAdCreator);
    return Promise.resolve({
      chainId: chainId.toString(),
      contractAddress,
      signature,
      signerPublicKey,
      authToken: `0x${authToken.toString('hex')}`,
      timeToExpire: timeToExpireNum,
      orderParams: params,
      nullifierHash,
      targetRoot,
      proof,
      reqHash: bufferToHex32(message),
      orderHash,
    });
  }

  // ── read-only contract views (simulateTransaction) ──────────────────

  private async simulateView<T>(
    contractAddressHex: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<T> {
    const server = this.getServer();
    const contract = new Contract(hex32ToContractId(contractAddressHex));
    // Use a throwaway source account — simulateTransaction only needs the
    // sequence, not a valid signer.
    const { publicKey } = this.getSigner();
    const sourceKey = StrKey.encodeEd25519PublicKey(publicKey);
    const sourceAccount = await server.getAccount(sourceKey);
    const tx = new TransactionBuilder(sourceAccount, {
      fee: DEFAULT_BASE_FEE,
      networkPassphrase: this.networkPassphrase(),
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Stellar simulate failed [${method}]: ${sim.error}`);
    }
    if (!sim.result) {
      throw new Error(`Stellar simulate [${method}] returned no result`);
    }
    return scValToNative(sim.result.retval) as T;
  }

  private async invokeWrite(
    contractAddressHex: string,
    method: string,
    args: xdr.ScVal[],
  ): Promise<string> {
    const server = this.getServer();
    const contract = new Contract(hex32ToContractId(contractAddressHex));
    const { keypair, publicKey } = this.getSigner();
    const sourceKey = StrKey.encodeEd25519PublicKey(publicKey);
    const sourceAccount = await server.getAccount(sourceKey);
    const tx = new TransactionBuilder(sourceAccount, {
      fee: DEFAULT_BASE_FEE,
      networkPassphrase: this.networkPassphrase(),
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(60)
      .build();
    const prepared = await server.prepareTransaction(tx);
    prepared.sign(keypair);
    const sent = await server.sendTransaction(prepared);
    if (sent.status === 'ERROR') {
      throw new Error(
        `Stellar send failed [${method}]: ${JSON.stringify(sent.errorResult)}`,
      );
    }
    let attempts = 0;
    let result = await server.getTransaction(sent.hash);
    while (
      result.status === rpc.Api.GetTransactionStatus.NOT_FOUND &&
      attempts < 15
    ) {
      await new Promise((r) => setTimeout(r, 1000));
      result = await server.getTransaction(sent.hash);
      attempts += 1;
    }
    if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
      throw new Error(
        `Stellar tx [${method}] status=${result.status} hash=${sent.hash}`,
      );
    }
    return sent.hash;
  }

  async validateAdManagerRequest(data: T_RequestValidation): Promise<boolean> {
    return this.simulateView<boolean>(
      data.contractAddress,
      'check_request_hash_exists',
      [nativeToScVal(hex32ToBuffer(data.reqHash), { type: 'bytes' })],
    );
  }

  async validateOrderPortalRequest(
    data: T_RequestValidation,
  ): Promise<boolean> {
    return this.simulateView<boolean>(
      data.contractAddress,
      'check_request_hash_exists',
      [nativeToScVal(hex32ToBuffer(data.reqHash), { type: 'bytes' })],
    );
  }

  async fetchOnChainLatestRoot(
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<string> {
    return isAdCreator
      ? this.fetchAdChainLatestRoot(data)
      : this.fetchOrderChainLatestRoot(data);
  }

  async fetchAdChainLatestRoot(data: T_FetchRoot): Promise<string> {
    const raw = await this.simulateView<Buffer | Uint8Array>(
      data.contractAddress,
      'get_latest_merkle_root',
      [],
    );
    return bufferToHex32(Buffer.from(raw));
  }

  async fetchOrderChainLatestRoot(data: T_FetchRoot): Promise<string> {
    const raw = await this.simulateView<Buffer | Uint8Array>(
      data.contractAddress,
      'get_latest_merkle_root',
      [],
    );
    return bufferToHex32(Buffer.from(raw));
  }

  async checkLocalRootExist(
    localRoot: string,
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<boolean> {
    const onChainRoots = await this.fetchOnChainRoots(isAdCreator, data);
    const needle = localRoot.toLowerCase();
    return onChainRoots.map((r) => r.toLowerCase()).includes(needle);
  }

  async fetchOnChainRoots(
    isAdCreator: boolean,
    data: T_FetchRoot,
  ): Promise<string[]> {
    return isAdCreator
      ? this.fetchOrderChainRoots(data)
      : this.fetchAdChainRoots(data);
  }

  async fetchAdChainRoots(data: T_FetchRoot): Promise<string[]> {
    return this.fetchHistoricalRoots(data);
  }

  async fetchOrderChainRoots(data: T_FetchRoot): Promise<string[]> {
    return this.fetchHistoricalRoots(data);
  }

  private async fetchHistoricalRoots(data: T_FetchRoot): Promise<string[]> {
    const leafCount = await this.simulateView<bigint>(
      data.contractAddress,
      'get_merkle_leaf_count',
      [],
    );
    const roots: string[] = [];
    const max = Number(leafCount);
    for (let i = 1; i <= max; i++) {
      try {
        const raw = await this.simulateView<Buffer | Uint8Array>(
          data.contractAddress,
          'get_historical_root',
          [nativeToScVal(BigInt(i), { type: 'u128' })],
        );
        roots.push(bufferToHex32(Buffer.from(raw)));
      } catch (err) {
        console.warn(`[stellar historicalRoot] index=${i} failed:`, err);
      }
    }
    return roots;
  }

  async mintToken(data: {
    chainId: string;
    tokenAddress: `0x${string}`;
    receiver: `0x${string}`;
  }): Promise<{ txHash: string }> {
    const receiverStrkey = StrKey.isValidEd25519PublicKey(data.receiver)
      ? data.receiver
      : StrKey.encodeEd25519PublicKey(hex32ToBuffer(data.receiver));
    const amount = BigNumber('1000000').multipliedBy(1e7).toFixed(0);
    const txHash = await this.invokeWrite(data.tokenAddress, 'mint', [
      new Address(receiverStrkey).toScVal(),
      nativeToScVal(BigInt(amount), { type: 'i128' }),
    ]);
    return { txHash };
  }

  async checkTokenBalance(data: {
    chainId: string;
    tokenAddress: `0x${string}`;
    account: `0x${string}`;
  }): Promise<string> {
    const accountStrkey = StrKey.isValidEd25519PublicKey(data.account)
      ? data.account
      : StrKey.encodeEd25519PublicKey(hex32ToBuffer(data.account));
    const balance = await this.simulateView<bigint>(
      data.tokenAddress,
      'balance',
      [new Address(accountStrkey).toScVal()],
    );
    return balance.toString();
  }

  orderTypeHash(orderParams: T_OrderParams): string {
    return computeOrderHash(orderParams);
  }

  // Verify a Stellar-wallet signature over the unlock authorization message.
  // Off-chain only — this authorizes the unlock request on the relayer and
  // never goes on-chain.
  //
  // Freighter's `signMessage` wraps the raw message with a domain separator
  // and sha256-hashes before ed25519 signing:
  //   sha256("Stellar Signed Message:\n" + message) → 32-byte digest → ed25519.
  // We rebuild the same pretty-printed JSON the frontend showed the user,
  // apply the same prefix+sha256, and verify the sig. Signature arrives
  // base64-encoded from the kit; we also accept `0x`-hex for direct-bytes
  // callers.
  //
  // "address" is the G-strkey or its 32-byte hex; the 32-byte payload is the
  // ed25519 public key.
  verifyOrderSignature(
    address: `0x${string}`,
    orderHash: `0x${string}`,
    orderParams: T_OrderParams,
    signature: string,
  ): boolean {
    try {
      const publicKey = hex32ToBuffer(address);
      const sigBytes = signature.startsWith('0x')
        ? Buffer.from(signature.slice(2), 'hex')
        : Buffer.from(signature, 'base64');
      if (sigBytes.length !== 64) return false;

      const message = buildStellarUnlockMessage({ ...orderParams, orderHash });
      const digest = stellarSignedMessageDigest(message);
      return verifyEd25519(digest, sigBytes, publicKey);
    } catch {
      return false;
    }
  }
}
