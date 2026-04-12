import { INestApplication } from '@nestjs/common';
import { createTestingApp } from '../setups/create-app';
import {
  fundEthAddress,
  fundHBar,
  loginUser,
  makeEthClient,
  makeHederaClient,
} from '../setups/utils';
import * as ethContracts from '../setups/eth-deployed-contracts.json';
import * as hederaContracts from '../setups/hedera-deployed-contracts.json';
import {
  getRoutes,
  apiCreateAd,
  apiConfirm,
  apiFundAd,
  apiWithdraw,
  apiUpdateAd,
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
  createAd,
  fundAd,
  withdrawAdFunds,
  approveToken,
  mintToken,
  closeAd,
  createOrder,
  lockForOrder,
  unlockOrderChain,
  unlockAdChain,
} from '../setups/contract-actions';
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
  T_AdManagerOrderParams,
  T_OrderParams,
  T_OrderPortalParams,
} from '../../src/providers/viem/types';
import { TypedDataEncoder } from 'ethers';

describe('Integrations E2E — (ETH → Hedera)', () => {
  let app: INestApplication;
  const privateKey1 = generatePrivateKey();
  const account1 = privateKeyToAccount(privateKey1);
  const privatekey2 = generatePrivateKey();
  const account2 = privateKeyToAccount(privatekey2);
  const ethChain = {
    ...ethContracts,
    adManagerAddress: ethContracts.adManagerAddress as `0x${string}`,
    orderPortalAddress: ethContracts.orderPortalAddress as `0x${string}`,
    tokenAddress: ethContracts.tokenAddress as `0x${string}`,
  };

  const hederaChain = {
    ...hederaContracts,
    adManagerAddress: hederaContracts.adManagerAddress as `0x${string}`,
    orderPortalAddress: hederaContracts.orderPortalAddress as `0x${string}`,
    tokenAddress: hederaContracts.tokenAddress as `0x${string}`,
  };

  const ethClient = makeEthClient();
  const hederaClient = makeHederaClient();

  let route: AdResponseDto;

  beforeAll(async () => {
    app = await createTestingApp();
    await fundEthAddress(ethClient, account1.address);
    await fundHBar(hederaClient, account1.address);
    await fundHBar(hederaClient, account2.address);

    // Fetch available routes between chains
    const routes = await getRoutes(
      app,
      ethContracts.chainId.toString(),
      hederaContracts.chainId.toString(),
    ).expect(200);

    expect(routes.body.data.length).toBeGreaterThan(0);

    route = routes.body.data[0] as AdResponseDto;
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  it('Ad lifecycle', async () => {
    // Login and get access token
    const access = await loginUser(app, privateKey1);

    await mintToken(
      ethClient,
      account1,
      ethChain.tokenAddress,
      account1.address,
      parseEther('100'),
    );

    await approveToken(
      ethClient,
      account1,
      ethChain.tokenAddress,
      ethChain.adManagerAddress,
      parseEther('5'),
    );

    // Step 1: Create a new advertisement
    const create = await apiCreateAd(
      app,
      access,
      route.id,
      account1.address,
      parseEther('5').toString(),
    ).expect(201);

    const req = create.body as CreateAdResponseDto;
    console.log(req);
    console.log(create);
    const adId = req.adId;

    expect(ethChain.adManagerAddress).toEqual(req.contractAddress);

    // Create advertisement on blockchain
    const txCreate = await createAd(
      ethClient,
      account1,
      req.signature,
      req.authToken as `0x${string}`,
      req.timeToExpire,
      req.adId,
      req.adToken,
      req.initialAmount,
      req.orderChainId,
      req.adRecipient,
      req.contractAddress,
    );
    await apiConfirm(app, adId, access, txCreate).expect(200);

    // Verify ad status after creation
    const adAfterCreate = await apiGetAd(app, adId).expect(200);

    expectObject(adAfterCreate.body, {
      id: adId,
      status: 'ACTIVE',
      poolAmount: parseEther('5').toString(),
    });

    // Step 2: Fund the advertisement
    const topup = await apiFundAd(app, adId, access, '10').expect(200);
    expect(ethChain.adManagerAddress).toEqual(topup.body.contractAddress);

    // Mint and approve tokens for funding
    await mintToken(
      ethClient,
      account1,
      ethChain.tokenAddress,
      account1.address,
      parseEther('100'),
    );
    await approveToken(
      ethClient,
      account1,
      ethChain.tokenAddress,
      ethChain.adManagerAddress,
      parseEther('10'),
    );

    // Fund ad on blockchain
    const txFund = await fundAd(
      ethClient,
      account1,
      topup.body.signature,
      topup.body.authToken,
      topup.body.timeToExpire,
      topup.body.adId,
      BigInt(topup.body.amount),
      topup.body.contractAddress,
    );
    await apiConfirm(app, adId, access, txFund).expect(200);

    // Verify ad is active with correct pool amount
    const activeAd = await apiGetAd(app, adId).expect(200);

    expectObject(activeAd.body, {
      poolAmount: parseEther('15').toString(),
      status: 'ACTIVE',
    });

    // Step 3: Withdraw funds from advertisement
    const withdraw = await apiWithdraw(
      app,
      adId,
      access,
      '3',
      account1.address,
    ).expect(200);

    // Execute withdrawal on blockchain
    const txW = await withdrawAdFunds(
      ethClient,
      account1,
      withdraw.body.signature,
      withdraw.body.authToken,
      withdraw.body.timeToExpire,
      withdraw.body.adId,
      BigInt(withdraw.body.amount),
      withdraw.body.to,
      withdraw.body.contractAddress,
    );
    await apiConfirm(app, adId, access, txW).expect(200);

    // Verify remaining pool amount after withdrawal
    const afterWithdraw = await apiGetAd(app, adId).expect(200);

    expectObject(afterWithdraw.body, {
      poolAmount: parseEther('12').toString(),
      status: 'ACTIVE',
    });

    // Step 4: Update advertisement parameters
    await apiUpdateAd(app, adId, access, {
      status: 'PAUSED',
      minAmount: parseEther('0.05').toString(),
      maxAmount: parseEther('1').toString(),
      metadata: { test: 'data' },
    }).expect(200);

    // Verify updated parameters
    const afterUpdate = await apiGetAd(app, adId).expect(200);

    expectObject(afterUpdate.body, {
      status: 'PAUSED',
      minAmount: parseEther('0.05').toString(),
      maxAmount: parseEther('1').toString(),
      metadata: { test: 'data' },
    });

    // Reactivate the advertisement
    await apiUpdateAd(app, adId, access, { status: 'ACTIVE' }).expect(200);

    // Step 5: Close advertisement
    const close = await apiCloseAd(app, adId, access, {
      to: account1.address,
    }).expect(200);

    // Execute closure on blockchain
    const txClose = await closeAd(
      ethClient,
      account1,
      close.body.signature,
      close.body.authToken,
      close.body.timeToExpire,
      close.body.adId,
      close.body.to,
      close.body.contractAddress,
    );

    await apiConfirm(app, adId, access, txClose).expect(200);

    // Verify final state
    const finalAd = await apiGetAd(app, adId);

    expectObject(finalAd.body, { status: 'CLOSED', poolAmount: '0' });
  }, 300_000);

  it('Trade lifecycle', async () => {
    const access = await loginUser(app, privateKey1);

    await mintToken(
      ethClient,
      account1,
      ethChain.tokenAddress,
      account1.address,
      parseEther('100'),
    );

    await approveToken(
      ethClient,
      account1,
      ethChain.tokenAddress,
      ethChain.adManagerAddress,
      parseEther('5'),
    );

    // Step 1: Create a new advertisement
    const create = await apiCreateAd(
      app,
      access,
      route.id,
      account1.address,
      parseEther('5').toString(),
    ).expect(201);

    const req = create.body as CreateAdResponseDto;
    const adId = req.adId;

    expect(ethChain.adManagerAddress).toEqual(req.contractAddress);
    expect(ethChain.chainId).toEqual(req.chainId);

    // Create advertisement on blockchain
    const txCreate = await createAd(
      ethClient,
      account1,
      req.signature,
      req.authToken as `0x${string}`,
      req.timeToExpire,
      req.adId,
      req.adToken,
      req.initialAmount,
      req.orderChainId,
      req.adRecipient,
      req.contractAddress,
    );
    await apiConfirm(app, adId, access, txCreate).expect(200);

    // Step 2: Fund the advertisement
    const topup = await apiFundAd(app, adId, access, '50').expect(200);
    expect(ethChain.adManagerAddress).toEqual(topup.body.contractAddress);
    expect(ethChain.chainId).toEqual(topup.body.chainId);

    // Mint and approve tokens for funding
    await mintToken(
      ethClient,
      account1,
      ethChain.tokenAddress,
      account1.address,
      parseEther('100'),
    );
    await approveToken(
      ethClient,
      account1,
      ethChain.tokenAddress,
      ethChain.adManagerAddress,
      parseEther('50'),
    );

    // Fund ad on blockchain
    const txFund = await fundAd(
      ethClient,
      account1,
      topup.body.signature,
      topup.body.authToken,
      topup.body.timeToExpire,
      topup.body.adId,
      BigInt(topup.body.amount),
      topup.body.contractAddress,
    );
    await apiConfirm(app, adId, access, txFund).expect(200);

    // Step2 create order on orderchain
    const access2 = await loginUser(app, privatekey2);

    const order = await apiCreateOrder(app, access2, {
      adId: adId,
      routeId: route.id,
      amount: parseEther('20').toString(),
      bridgerDstAddress: account2.address,
    }).expect(201);

    const orderReq = order.body
      .reqContractDetails as CreateOrderRequestContractDetailsDto;

    const tradeId = order.body.tradeId as string;

    expect(hederaChain.orderPortalAddress).toEqual(orderReq.contractAddress);
    expect(hederaChain.chainId).toEqual(orderReq.chainId);
    const afterCreateOrder = await apiGetTrade(app, tradeId).expect(200);

    expectObject(afterCreateOrder.body, {
      adId: adId,
      routeId: route.id,
      amount: parseEther('20').toString(),
      bridgerAddress: getAddress(account2.address),
      adCreatorAddress: getAddress(account1.address),
      status: 'INACTIVE',
    });

    // Mint and approve tokens for funding
    await mintToken(
      hederaClient,
      account2,
      hederaChain.tokenAddress,
      account2.address,
      parseEther('100'),
    );

    await approveToken(
      hederaClient,
      account2,
      hederaChain.tokenAddress,
      hederaChain.orderPortalAddress,
      parseEther('25'),
    );

    const orderCreateTx = await createOrder(
      hederaClient,
      account2,
      orderReq.signature,
      orderReq.authToken as `0x${string}`,
      orderReq.timeToExpire,
      orderReq.orderParams as T_OrderPortalParams,
      hederaChain.orderPortalAddress,
    );

    await apiTradeConfirm(app, tradeId, access2, orderCreateTx).expect(200);

    const afterChainDeposit = await apiGetTrade(app, tradeId).expect(200);
    expectObject(afterChainDeposit.body, {
      id: tradeId,
      adId: adId,
      status: 'ACTIVE',
    });

    // Lock Order on Ad chain
    const lockOrder = await apiLockOrder(app, access, tradeId).expect(200);

    const lockOrderReq = lockOrder.body as LockForOrderResponseDto;

    expect(getAddress(ethChain.adManagerAddress)).toEqual(
      getAddress(lockOrderReq.contractAddress),
    );

    expect(ethChain.chainId).toEqual(lockOrderReq.chainId);

    // check that it still remains active
    const lockOrderBefore = await apiGetTrade(app, tradeId);

    expectObject(lockOrderBefore.body, {
      status: 'ACTIVE',
    });

    const lockTxn = await lockForOrder(
      ethClient,
      account1,
      lockOrderReq.signature as `0x${string}`,
      lockOrderReq.authToken as `0x${string}`,
      lockOrderReq.timeToExpire,
      lockOrderReq.orderParams as T_AdManagerOrderParams,
      getAddress(lockOrderReq.contractAddress),
    );

    await apiTradeConfirm(app, tradeId, access, lockTxn).expect(200);

    const lockOrderAfter = await apiGetTrade(app, tradeId);

    expectObject(lockOrderAfter.body, {
      status: 'LOCKED',
    });

    /// AD MANAGER UNLOCKKKKKKK ///

    const orderParamsResponse = await apiTradeParams(
      app,
      access,
      tradeId,
    ).expect(200);

    const orderParams = orderParamsResponse.body as T_OrderParams;

    const signature = await signTypedOrder(privateKey1, orderParams);
    const orderHash = TypedDataEncoder.hash(domain, orderTypes, orderParams);
    const isValid = verifyTypedData(
      orderHash as `0x${string}`,
      signature as `0x${string}`,
      account1.address,
    );

    expect(isValid).toBe(true);

    const unlock = await apiUnlockOrder(app, access, tradeId, signature);

    const unlockReq = unlock.body as UnlockOrderResponseDto;

    expect(unlockReq.contractAddress).toEqual(hederaChain.orderPortalAddress);
    expect(unlockReq.chainId).toEqual(hederaChain.chainId);

    const unlockOrderChainTx = await unlockOrderChain(
      hederaClient,
      account1,
      unlockReq.signature,
      unlockReq.authToken as `0x${string}`,
      unlockReq.timeToExpire,
      unlockReq.orderParams as T_OrderPortalParams,
      unlockReq.nullifierHash as `0x${string}`,
      unlockReq.targetRoot as `0x${string}`,
      unlockReq.proof as `0x${string}`,
      unlockReq.contractAddress,
    );

    await apiTradeUnlockConfirm(
      app,
      access,
      tradeId,
      unlockOrderChainTx,
    ).expect(200);

    /// BRIDGER MANAGER UNLOCKKKKKKK ///

    const orderParamsResponseBridger = await apiTradeParams(
      app,
      access2,
      tradeId,
    ).expect(200);

    const orderParamsBridger = orderParamsResponseBridger.body as T_OrderParams;

    const signatureBridger = await signTypedOrder(
      privatekey2,
      orderParamsBridger,
    );
    const orderHashBridger = TypedDataEncoder.hash(
      domain,
      orderTypes,
      orderParamsBridger,
    );
    const isValidBridger = verifyTypedData(
      orderHashBridger as `0x${string}`,
      signatureBridger as `0x${string}`,
      account2.address,
    );

    expect(isValidBridger).toBe(true);

    const unlockBridger = await apiUnlockOrder(
      app,
      access2,
      tradeId,
      signatureBridger,
    ).expect(200);

    const unlockReqBridger = unlockBridger.body as UnlockOrderResponseDto;

    expect(unlockReqBridger.contractAddress).toEqual(ethChain.adManagerAddress);
    expect(unlockReqBridger.chainId).toEqual(ethChain.chainId);

    const unlockOrderChainTxBridger = await unlockAdChain(
      ethClient,
      account1,
      unlockReqBridger.signature,
      unlockReqBridger.authToken as `0x${string}`,
      unlockReqBridger.timeToExpire,
      unlockReqBridger.orderParams as T_AdManagerOrderParams,
      unlockReqBridger.nullifierHash as `0x${string}`,
      unlockReqBridger.targetRoot as `0x${string}`,
      unlockReqBridger.proof as `0x${string}`,
      unlockReqBridger.contractAddress,
    );

    await apiTradeUnlockConfirm(
      app,
      access2,
      tradeId,
      unlockOrderChainTxBridger,
    ).expect(200);
  }, 300_000);
});
