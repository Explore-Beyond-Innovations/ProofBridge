import { INestApplication } from '@nestjs/common';
import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { createTestingApp } from '../setups/create-app';
import {
  fundEthAddress,
  loginStellarUser,
  loginUser,
  makeEthClient,
} from '../setups/utils';
import * as ethContracts from '../setups/evm-deployed-contracts.json';
import {
  getRoutes,
  apiCreateAd,
  apiConfirm,
  apiFundAd,
  apiWithdraw,
  apiGetAd,
  apiCloseAd,
  apiCreateOrder,
  apiGetTrade,
  apiTradeConfirm,
  apiLockOrder,
  apiTradeParams,
  apiUnlockOrder,
  apiTradeUnlockConfirm,
} from './api';
import {
  createOrder,
  unlockOrderChain,
  mintToken,
  approveToken,
} from '../setups/evm-actions';
import {
  createAdSoroban,
  fundAdSoroban,
  withdrawFromAdSoroban,
  closeAdSoroban,
  lockForOrderSoroban,
  unlockSoroban,
  StellarOrderParams,
} from '../setups/stellar-actions';
import type { StellarChainData } from '../setups/stellar-setup';
import { getAddress, parseEther } from 'viem';
import { expectObject } from '../setups/utils';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import {
  AdResponseDto,
  CreateAdResponseDto,
} from '../../src/modules/ads/dto/ad.dto';
import {
  CreateOrderRequestContractDetailsDto,
  LockForOrderResponseDto,
  UnlockOrderResponseDto,
} from '../../src/modules/trades/dto/trade.dto';
import {
  domain,
  orderTypes,
  signTypedOrder,
  verifyTypedData,
} from '../../src/providers/viem/ethers/typedData';
import {
  T_OrderParams,
  T_OrderPortalParams,
} from '../../src/chain-adapters/types';
import { TypedDataEncoder } from 'ethers';

// Gate the entire suite on the external orchestrator having provisioned
// a Stellar localnet + keypairs. When running `jest` standalone without the
// bash runner, the global will be unset and we skip cleanly.
const stellarContracts = (global as any).__STELLAR_CONTRACTS__ as
  | StellarChainData
  | undefined;
const describeIfStellar = stellarContracts ? describe : describe.skip;

describeIfStellar('Integrations E2E — (Stellar → ETH)', () => {
  let app: INestApplication;

  // EVM-side bridger (creates the order on the EVM order chain).
  const bridgerKey = generatePrivateKey();
  const bridger = privateKeyToAccount(bridgerKey);

  // Ad creator is a Stellar account. The orchestrator passes the secret via
  // STELLAR_AD_CREATOR_SECRET; fall back to the deploy admin as a last resort.
  const adCreatorSecret =
    process.env.STELLAR_AD_CREATOR_SECRET ||
    (stellarContracts?.adminSecret as string);
  const adCreator = adCreatorSecret
    ? Keypair.fromSecret(adCreatorSecret)
    : Keypair.random();
  // EVM destination for the ad creator's proceeds on unlock.
  const adCreatorEvmKey = generatePrivateKey();
  const adCreatorEvm = privateKeyToAccount(adCreatorEvmKey);

  const ethChain = {
    ...ethContracts,
    adManagerAddress: ethContracts.adManagerAddress as `0x${string}`,
    orderPortalAddress: ethContracts.orderPortalAddress as `0x${string}`,
    tokenAddress: ethContracts.tokenAddress as `0x${string}`,
  };

  const ethClient = makeEthClient();

  let route: AdResponseDto;

  beforeAll(async () => {
    app = await createTestingApp();
    await fundEthAddress(ethClient, bridger.address);
    await fundEthAddress(ethClient, adCreatorEvm.address);

    // Route: Stellar ad token → EVM order token.
    const routes = await getRoutes(
      app,
      stellarContracts!.chainId,
      ethChain.chainId.toString(),
    ).expect(200);
    expect(routes.body.data.length).toBeGreaterThan(0);
    route = routes.body.data[0] as AdResponseDto;
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('Ad lifecycle', async () => {
    const access = await loginStellarUser(app, adCreator);

    // Create ad — Stellar uses 7-decimal XLM; use a modest amount in stroops.
    const INITIAL = '500000000'; // 50 XLM
    const create = await apiCreateAd(
      app,
      access,
      route.id,
      adCreatorEvm.address,
      INITIAL,
    ).expect(201);

    const req = create.body as CreateAdResponseDto;
    const adId = req.adId;

    const txCreate = await createAdSoroban(
      adCreator,
      req.signature,
      (req as any).signer,
      req.authToken,
      req.timeToExpire,
      adCreator.publicKey(),
      req.adId,
      req.adToken,
      req.initialAmount,
      req.orderChainId,
      req.adRecipient,
      req.contractAddress,
    );
    await apiConfirm(app, adId, access, txCreate as `0x${string}`).expect(200);

    const adAfterCreate = await apiGetAd(app, adId).expect(200);
    expectObject(adAfterCreate.body, {
      id: adId,
      status: 'ACTIVE',
      poolAmount: INITIAL,
    });

    // Fund.
    const topup = await apiFundAd(app, adId, access, '5').expect(200);
    const txFund = await fundAdSoroban(
      adCreator,
      topup.body.signature,
      topup.body.signer,
      topup.body.authToken,
      topup.body.timeToExpire,
      topup.body.adId,
      topup.body.amount,
      topup.body.contractAddress,
    );
    await apiConfirm(app, adId, access, txFund as `0x${string}`).expect(200);

    // Withdraw — destination is the ad creator's Stellar account.
    const withdraw = await apiWithdraw(
      app,
      adId,
      access,
      '1',
      adCreator.publicKey() as `0x${string}`,
    ).expect(200);
    const txW = await withdrawFromAdSoroban(
      adCreator,
      withdraw.body.signature,
      withdraw.body.signer,
      withdraw.body.authToken,
      withdraw.body.timeToExpire,
      withdraw.body.adId,
      withdraw.body.amount,
      StrKey.isValidEd25519PublicKey(withdraw.body.to)
        ? withdraw.body.to
        : adCreator.publicKey(),
      withdraw.body.contractAddress,
    );
    await apiConfirm(app, adId, access, txW as `0x${string}`).expect(200);

    // Close.
    const close = await apiCloseAd(app, adId, access, {
      to: adCreator.publicKey(),
    }).expect(200);
    const txClose = await closeAdSoroban(
      adCreator,
      close.body.signature,
      close.body.signer,
      close.body.authToken,
      close.body.timeToExpire,
      close.body.adId,
      StrKey.isValidEd25519PublicKey(close.body.to)
        ? close.body.to
        : adCreator.publicKey(),
      close.body.contractAddress,
    );
    await apiConfirm(app, adId, access, txClose as `0x${string}`).expect(200);

    const finalAd = await apiGetAd(app, adId);
    expectObject(finalAd.body, { status: 'CLOSED', poolAmount: '0' });
  }, 600_000);

  it('Trade lifecycle', async () => {
    const adAccess = await loginStellarUser(app, adCreator);

    // Seed the ad.
    const INITIAL = '500000000'; // 50 XLM
    const create = await apiCreateAd(
      app,
      adAccess,
      route.id,
      adCreatorEvm.address,
      INITIAL,
    ).expect(201);
    const req = create.body as CreateAdResponseDto;
    const adId = req.adId;

    const txCreate = await createAdSoroban(
      adCreator,
      req.signature,
      (req as any).signer,
      req.authToken,
      req.timeToExpire,
      adCreator.publicKey(),
      req.adId,
      req.adToken,
      req.initialAmount,
      req.orderChainId,
      req.adRecipient,
      req.contractAddress,
    );
    await apiConfirm(app, adId, adAccess, txCreate as `0x${string}`).expect(200);

    // Bridger creates the order on the EVM side.
    const bridgerAccess = await loginUser(app, bridgerKey);

    // Bridger's destination on the ad chain is a Stellar account (the ad creator here).
    const order = await apiCreateOrder(app, bridgerAccess, {
      adId,
      routeId: route.id,
      amount: '100000000', // 10 XLM worth
      bridgerDstAddress: adCreator.publicKey(),
    }).expect(201);

    const orderReq = order.body
      .reqContractDetails as CreateOrderRequestContractDetailsDto;
    const tradeId = order.body.tradeId as string;

    expect(getAddress(ethChain.orderPortalAddress)).toEqual(
      getAddress(orderReq.contractAddress),
    );

    await mintToken(
      ethClient,
      bridger,
      ethChain.tokenAddress,
      bridger.address,
      parseEther('1000'),
    );
    await approveToken(
      ethClient,
      bridger,
      ethChain.tokenAddress,
      ethChain.orderPortalAddress,
      parseEther('100'),
    );

    const orderCreateTx = await createOrder(
      ethClient,
      bridger,
      orderReq.signature,
      orderReq.authToken as `0x${string}`,
      orderReq.timeToExpire,
      orderReq.orderParams as T_OrderPortalParams,
      ethChain.orderPortalAddress,
    );
    await apiTradeConfirm(app, tradeId, bridgerAccess, orderCreateTx).expect(
      200,
    );

    // Lock on the Stellar ad chain — signed by the ad creator (maker).
    const lockOrder = await apiLockOrder(app, adAccess, tradeId).expect(200);
    const lockReq = lockOrder.body as LockForOrderResponseDto;

    const lockTxn = await lockForOrderSoroban(
      adCreator,
      lockReq.signature as `0x${string}`,
      (lockReq as any).signer,
      lockReq.authToken as `0x${string}`,
      lockReq.timeToExpire,
      lockReq.orderParams as unknown as StellarOrderParams,
      lockReq.contractAddress,
    );
    await apiTradeConfirm(app, tradeId, adAccess, lockTxn as `0x${string}`).expect(
      200,
    );

    const afterLock = await apiGetTrade(app, tradeId);
    expectObject(afterLock.body, { status: 'LOCKED' });

    // Ad-creator unlocks on the EVM order chain.
    const adCreatorParams = await apiTradeParams(app, adAccess, tradeId).expect(
      200,
    );
    const adCreatorOrderParams = adCreatorParams.body as T_OrderParams;
    // Ad-creator signs with their EVM destination key so the order chain
    // recognises the signature.
    const adCreatorSig = await signTypedOrder(
      adCreatorEvmKey,
      adCreatorOrderParams,
    );
    const adCreatorHash = TypedDataEncoder.hash(
      domain,
      orderTypes,
      adCreatorOrderParams,
    );
    expect(
      verifyTypedData(
        adCreatorHash as `0x${string}`,
        adCreatorSig as `0x${string}`,
        adCreatorEvm.address,
      ),
    ).toBe(true);

    const unlockOnOrder = await apiUnlockOrder(
      app,
      adAccess,
      tradeId,
      adCreatorSig,
    ).expect(200);
    const unlockOrderReq = unlockOnOrder.body as UnlockOrderResponseDto;

    const unlockOrderTx = await unlockOrderChain(
      ethClient,
      adCreatorEvm,
      unlockOrderReq.signature,
      unlockOrderReq.authToken as `0x${string}`,
      unlockOrderReq.timeToExpire,
      unlockOrderReq.orderParams as T_OrderPortalParams,
      unlockOrderReq.nullifierHash as `0x${string}`,
      unlockOrderReq.targetRoot as `0x${string}`,
      unlockOrderReq.proof as `0x${string}`,
      unlockOrderReq.contractAddress,
    );
    await apiTradeUnlockConfirm(app, adAccess, tradeId, unlockOrderTx).expect(
      200,
    );

    // Bridger unlocks on the Stellar ad chain.
    const bridgerParams = await apiTradeParams(
      app,
      bridgerAccess,
      tradeId,
    ).expect(200);
    const bridgerOrderParams = bridgerParams.body as T_OrderParams;
    const bridgerSig = await signTypedOrder(bridgerKey, bridgerOrderParams);

    const unlockOnAd = await apiUnlockOrder(
      app,
      bridgerAccess,
      tradeId,
      bridgerSig,
    ).expect(200);
    const unlockAdReq = unlockOnAd.body as UnlockOrderResponseDto;

    const unlockAdTx = await unlockSoroban(
      adCreator,
      unlockAdReq.signature as `0x${string}`,
      (unlockAdReq as any).signer,
      unlockAdReq.authToken as `0x${string}`,
      unlockAdReq.timeToExpire,
      unlockAdReq.orderParams as unknown as StellarOrderParams,
      unlockAdReq.nullifierHash as `0x${string}`,
      unlockAdReq.targetRoot as `0x${string}`,
      Buffer.from((unlockAdReq.proof as string).replace(/^0x/, ''), 'hex'),
      unlockAdReq.contractAddress,
    );
    await apiTradeUnlockConfirm(
      app,
      bridgerAccess,
      tradeId,
      unlockAdTx as `0x${string}`,
    ).expect(200);
  }, 600_000);
});
