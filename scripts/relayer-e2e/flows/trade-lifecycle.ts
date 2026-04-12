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
import { assert, assertObject, phase } from "../lib/assert.js";
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

  const ethClient = makeEthClient();
  await fundEthAddress(ethClient, bridger.address);
  await fundEthAddress(ethClient, adCreatorEvm.address);

  const routes = expectStatus(
    await getRoutes(stellarChainId, evmChainId),
    200,
    "getRoutes",
  );
  assert(routes.body.data.length > 0, "no routes seeded");
  const route = routes.body.data[0];

  const adAccess = await loginStellar(adCreator);

  // Seed the ad.
  const INITIAL = toBaseUnits("50", "STELLAR");
  const create = expectStatus(
    await apiCreateAd(adAccess, route.id, adCreatorEvm.address, INITIAL),
    201,
    "apiCreateAd",
  );
  const req = create.body as any;
  const adId = req.adId;
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
  expectStatus(
    await apiConfirm(adId, adAccess, txCreate as `0x${string}`),
    200,
    "apiConfirm(create)",
  );

  // Bridger creates the order on EVM.
  const bridgerAccess = await loginEvm(bridgerKey);
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

  // Mint + approve test tokens to the order portal.
  const evmTokenAddress = orderReq.orderParams.orderChainToken; // bytes32
  // addresses in orderParams are bytes32 — the portal address is the contractAddress field.
  const orderPortalAddress = orderReq.contractAddress as `0x${string}`;

  // Need the real (20-byte) token address — recover from the orderParams
  // bytes32 by slicing the last 20 bytes.
  const tokenAddr20 = getAddress(`0x${evmTokenAddress.slice(-40)}`);

  await mintToken(ethClient, bridger, tokenAddr20, bridger.address, parseEther("1000"));
  await approveToken(ethClient, bridger, tokenAddr20, orderPortalAddress, parseEther("100"));

  const orderCreateTx = await createOrder(
    ethClient,
    bridger,
    orderReq.signature,
    orderReq.authToken as `0x${string}`,
    orderReq.timeToExpire,
    orderReq.orderParams,
    orderPortalAddress,
  );
  expectStatus(
    await apiTradeConfirm(tradeId, bridgerAccess, orderCreateTx),
    200,
    "apiTradeConfirm(order)",
  );

  // Lock on the Stellar ad chain.
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
  expectStatus(
    await apiTradeConfirm(tradeId, adAccess, lockTxn as `0x${string}`),
    200,
    "apiTradeConfirm(lock)",
  );

  const afterLock = expectStatus(
    await apiGetTrade(tradeId),
    200,
    "apiGetTrade(after lock)",
  );
  assertObject(afterLock.body, { status: "LOCKED" });

  // Ad-creator unlocks on EVM: sign with the EVM destination key (ECDSA).
  const adCreatorParams = expectStatus(
    await apiTradeParams(adAccess, tradeId),
    200,
    "apiTradeParams(adCreator)",
  );
  const adCreatorOrderParams = adCreatorParams.body;
  const adCreatorSig = await signTypedOrder(adCreatorEvmKey, adCreatorOrderParams);

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
  expectStatus(
    await apiTradeUnlockConfirm(adAccess, tradeId, unlockOrderTx),
    200,
    "apiTradeUnlockConfirm(adCreator)",
  );

  // Bridger unlocks on Stellar: ed25519 over the TypedDataEncoder hash.
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
  expectStatus(
    await apiTradeUnlockConfirm(bridgerAccess, tradeId, unlockAdTx as `0x${string}`),
    200,
    "apiTradeUnlockConfirm(bridger)",
  );

  console.log("[trade-lifecycle] passed");
}
