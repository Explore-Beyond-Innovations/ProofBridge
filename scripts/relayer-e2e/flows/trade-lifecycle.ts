// Trade lifecycle flow — port of the `Trade lifecycle` jest test in
// apps/backend-relayer/test/integrations/eth-stellar.e2e-integration.ts.
//
// Ad on Stellar, order on EVM. Ad creator unlocks on EVM (ECDSA). Bridger
// unlocks on Stellar (ed25519 over the order hash).

import { Keypair } from "@stellar/stellar-sdk";
import { getAddress, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { TypedDataEncoder } from "ethers";
import {
  apiCreateAd,
  apiConfirm,
  apiCreateOrder,
  apiTradeConfirm,
  apiLockOrder,
  apiTradeParams,
  apiUnlockOrder,
  apiTradeUnlockConfirm,
  apiGetTrade,
  getRoutes,
  expectStatus,
} from "../lib/api.js";
import { loginStellar, loginEvm } from "../lib/auth.js";
import { toBaseUnits } from "../lib/amount.js";
import { assert, assertObject, note, phase, step } from "../lib/assert.js";
import {
  createAdSoroban,
  lockForOrderSoroban,
  unlockSoroban,
} from "../lib/stellar-actions.js";
import {
  createOrder,
  unlockOrderChain,
  mintToken,
  approveToken,
} from "../lib/evm-actions.js";
import { makeEthClient, fundEthAddress } from "../lib/eth.js";
import {
  domain,
  orderTypes,
  signTypedOrder,
} from "../../../apps/backend-relayer/src/providers/viem/ethers/typedData.js";

export async function runTradeLifecycle(): Promise<void> {
  phase("B", "Trade lifecycle");

  const bridgerKey = process.env.EVM_ORDER_CREATOR_PRIVATE_KEY as `0x${string}`;
  const bridger = privateKeyToAccount(bridgerKey);

  const bridgerStellarSecret = process.env.STELLAR_ORDER_CREATOR_SECRET!;
  const bridgerStellar = Keypair.fromSecret(bridgerStellarSecret);

  const adCreatorSecret = process.env.STELLAR_AD_CREATOR_SECRET!;
  const adCreator = Keypair.fromSecret(adCreatorSecret);

  const adCreatorEvmKey = process.env.EVM_AD_CREATOR_PRIVATE_KEY as `0x${string}`;
  const adCreatorEvm = privateKeyToAccount(adCreatorEvmKey);

  const stellarChainId = process.env.STELLAR_CHAIN_ID!;
  const evmChainId = process.env.EVM_CHAIN_ID!;

  note(`ad creator stellar: ${adCreator.publicKey()}`);
  note(`ad creator evm dst: ${adCreatorEvm.address}`);
  note(`bridger evm: ${bridger.address}`);
  note(`bridger stellar dst: ${bridgerStellar.publicKey()}`);
  note(`stellar chain ${stellarChainId} → evm chain ${evmChainId}`);

  const ethClient = makeEthClient();
  await step("fund evm participants", async () => {
    await fundEthAddress(ethClient, bridger.address);
    await fundEthAddress(ethClient, adCreatorEvm.address);
  });

  const route = await step("fetch routes", async () => {
    const routes = expectStatus(
      await getRoutes(stellarChainId, evmChainId),
      200,
      "getRoutes",
    );
    assert(routes.body.data.length > 0, "no routes seeded");
    const r = routes.body.data[0];
    note(`route ${r.id}`);
    return r;
  });

  const adAccess = await step("login ad creator (stellar)", () =>
    loginStellar(adCreator),
  );

  const INITIAL = toBaseUnits("50", "STELLAR");
  const adId = await step(`seed ad (${INITIAL} base units)`, async () => {
    const create = expectStatus(
      await apiCreateAd(adAccess, route.id, adCreatorEvm.address, INITIAL),
      201,
      "apiCreateAd",
    );
    const req = create.body as any;
    note(`adId ${req.adId}`);
    const txCreate = await createAdSoroban(
      adCreator,
      req.signature,
      req.signerPublicKey,
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
    note(`soroban tx ${txCreate}`);
    expectStatus(
      await apiConfirm(req.adId, adAccess, txCreate as `0x${string}`),
      200,
      "apiConfirm(create)",
    );
    return req.adId as string;
  });

  const bridgerAccess = await step("login bridger (evm SIWE)", () =>
    loginEvm(bridgerKey),
  );

  const { tradeId, orderReq, orderPortalAddress, tokenAddr20 } = await step(
    "create order on EVM",
    async () => {
      const order = expectStatus(
        await apiCreateOrder(bridgerAccess, {
          adId,
          routeId: route.id,
          amount: toBaseUnits("10", "STELLAR"),
          bridgerDstAddress: bridgerStellar.publicKey(),
        }),
        201,
        "apiCreateOrder",
      );
      const orderReq = order.body.reqContractDetails;
      const tradeId = order.body.tradeId as string;
      const orderPortalAddress = orderReq.contractAddress as `0x${string}`;
      const tokenAddr20 = getAddress(
        `0x${orderReq.orderParams.orderChainToken.slice(-40)}`,
      );
      note(`tradeId ${tradeId}`);
      note(`orderPortal ${orderPortalAddress}`);
      note(`orderChainToken ${tokenAddr20}`);
      return { tradeId, orderReq, orderPortalAddress, tokenAddr20 };
    },
  );

  await step("mint + approve EVM test token for bridger", async () => {
    await mintToken(
      ethClient,
      bridger,
      tokenAddr20,
      bridger.address,
      parseEther("1000"),
    );
    await approveToken(
      ethClient,
      bridger,
      tokenAddr20,
      orderPortalAddress,
      parseEther("100"),
    );
  });

  await step("submit + confirm EVM createOrder", async () => {
    const orderCreateTx = await createOrder(
      ethClient,
      bridger,
      orderReq.signature,
      orderReq.authToken as `0x${string}`,
      orderReq.timeToExpire,
      orderReq.orderParams,
      orderPortalAddress,
    );
    note(`evm tx ${orderCreateTx}`);
    expectStatus(
      await apiTradeConfirm(tradeId, bridgerAccess, orderCreateTx),
      200,
      "apiTradeConfirm(order)",
    );
  });

  await step("lock on Stellar ad chain", async () => {
    const lockOrder = expectStatus(
      await apiLockOrder(adAccess, tradeId),
      200,
      "apiLockOrder",
    );
    const lockReq = lockOrder.body;
    const lockTxn = await lockForOrderSoroban(
      adCreator,
      lockReq.signature as `0x${string}`,
      lockReq.signerPublicKey,
      lockReq.authToken as `0x${string}`,
      lockReq.timeToExpire,
      lockReq.orderParams,
      lockReq.contractAddress,
    );
    note(`soroban tx ${lockTxn}`);
    expectStatus(
      await apiTradeConfirm(tradeId, adAccess, lockTxn as `0x${string}`),
      200,
      "apiTradeConfirm(lock)",
    );
  });

  await step("verify trade LOCKED", async () => {
    const afterLock = expectStatus(
      await apiGetTrade(tradeId),
      200,
      "apiGetTrade(after lock)",
    );
    assertObject(afterLock.body, { status: "LOCKED" });
  });

  await step("ad-creator unlocks on EVM (ECDSA)", async () => {
    const adCreatorParams = expectStatus(
      await apiTradeParams(adAccess, tradeId),
      200,
      "apiTradeParams(adCreator)",
    );
    const adCreatorOrderParams = adCreatorParams.body;
    const adCreatorSig = await signTypedOrder(
      adCreatorEvmKey,
      adCreatorOrderParams,
    );

    const unlockOnOrder = expectStatus(
      await apiUnlockOrder(adAccess, tradeId, adCreatorSig),
      200,
      "apiUnlockOrder(adCreator)",
    );
    const unlockOrderReq = unlockOnOrder.body;
    const unlockOrderTx = await unlockOrderChain(
      ethClient,
      adCreatorEvm,
      unlockOrderReq.signature,
      unlockOrderReq.authToken as `0x${string}`,
      unlockOrderReq.timeToExpire,
      unlockOrderReq.orderParams,
      unlockOrderReq.nullifierHash as `0x${string}`,
      unlockOrderReq.targetRoot as `0x${string}`,
      unlockOrderReq.proof as `0x${string}`,
      unlockOrderReq.contractAddress,
    );
    note(`evm tx ${unlockOrderTx}`);
    expectStatus(
      await apiTradeUnlockConfirm(adAccess, tradeId, unlockOrderTx),
      200,
      "apiTradeUnlockConfirm(adCreator)",
    );
  });

  await step("bridger unlocks on Stellar (ed25519)", async () => {
    const bridgerParams = expectStatus(
      await apiTradeParams(bridgerAccess, tradeId),
      200,
      "apiTradeParams(bridger)",
    );
    const bridgerOrderParams = bridgerParams.body;
    const bridgerOrderHash = TypedDataEncoder.hash(domain, orderTypes, {
      ...bridgerOrderParams,
      salt: BigInt(bridgerOrderParams.salt),
    });
    const bridgerSigBytes = bridgerStellar.sign(
      Buffer.from(bridgerOrderHash.replace(/^0x/, ""), "hex"),
    );
    const bridgerSig = `0x${bridgerSigBytes.toString("hex")}`;

    const unlockOnAd = expectStatus(
      await apiUnlockOrder(bridgerAccess, tradeId, bridgerSig),
      200,
      "apiUnlockOrder(bridger)",
    );
    const unlockAdReq = unlockOnAd.body;
    const unlockAdTx = await unlockSoroban(
      bridgerStellar,
      unlockAdReq.signature,
      unlockAdReq.signerPublicKey,
      unlockAdReq.authToken,
      unlockAdReq.timeToExpire,
      unlockAdReq.orderParams,
      unlockAdReq.nullifierHash,
      unlockAdReq.targetRoot,
      Buffer.from(unlockAdReq.proof.replace(/^0x/, ""), "hex"),
      unlockAdReq.contractAddress,
    );
    note(`soroban tx ${unlockAdTx}`);
    expectStatus(
      await apiTradeUnlockConfirm(
        bridgerAccess,
        tradeId,
        unlockAdTx as `0x${string}`,
      ),
      200,
      "apiTradeUnlockConfirm(bridger)",
    );
  });

  console.log("[trade-lifecycle] passed");
}
