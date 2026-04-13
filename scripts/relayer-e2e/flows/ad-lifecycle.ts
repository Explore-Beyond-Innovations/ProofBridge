// Ad lifecycle flow — port of the `Ad lifecycle` jest test in
// apps/backend-relayer/test/integrations/eth-stellar.e2e-integration.ts.
//
// Ad creator is a Stellar identity; its EVM destination is the anvil
// prefunded #2 address. The flow:
//   create → confirm → getAd → fund → confirm → withdraw → confirm → close → confirm

import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { privateKeyToAccount } from "viem/accounts";
import {
  apiCreateAd,
  apiConfirm,
  apiFundAd,
  apiWithdraw,
  apiGetAd,
  apiCloseAd,
  getRoutes,
  expectStatus,
} from "../lib/api.js";
import { loginStellar } from "../lib/auth.js";
import { toBaseUnits } from "../lib/amount.js";
import { assert, assertObject, note, phase, step } from "../lib/assert.js";
import {
  createAdSoroban,
  fundAdSoroban,
  withdrawFromAdSoroban,
  closeAdSoroban,
} from "../lib/stellar-actions.js";

export async function runAdLifecycle(): Promise<void> {
  phase("A", "Ad lifecycle");

  const adCreatorSecret = process.env.STELLAR_AD_CREATOR_SECRET!;
  const adCreator = Keypair.fromSecret(adCreatorSecret);

  const adCreatorEvmKey = process.env.EVM_AD_CREATOR_PRIVATE_KEY as `0x${string}`;
  const adCreatorEvm = privateKeyToAccount(adCreatorEvmKey);

  const stellarChainId = process.env.STELLAR_CHAIN_ID!;
  const evmChainId = process.env.EVM_CHAIN_ID!;

  note(`ad creator stellar: ${adCreator.publicKey()}`);
  note(`ad creator evm dst: ${adCreatorEvm.address}`);
  note(`stellar chain ${stellarChainId} → evm chain ${evmChainId}`);

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

  const access = await step("login (stellar SEP-10)", () => loginStellar(adCreator));

  const INITIAL = toBaseUnits("50", "STELLAR");
  const adId = await step(`create ad (${INITIAL} base units)`, async () => {
    const create = expectStatus(
      await apiCreateAd(access, route.id, adCreatorEvm.address, INITIAL),
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
      await apiConfirm(req.adId, access, txCreate as `0x${string}`),
      200,
      "apiConfirm(create)",
    );
    return req.adId as string;
  });

  await step("verify ad ACTIVE", async () => {
    const adAfterCreate = expectStatus(await apiGetAd(adId), 200, "apiGetAd(create)");
    assertObject(adAfterCreate.body, {
      id: adId,
      status: "ACTIVE",
      poolAmount: INITIAL,
    });
  });

  await step("fund ad (+5 XLM)", async () => {
    const topup = expectStatus(
      await apiFundAd(adId, access, toBaseUnits("5", "STELLAR")),
      200,
      "apiFundAd",
    );
    const txFund = await fundAdSoroban(
      adCreator,
      topup.body.signature,
      topup.body.signerPublicKey,
      topup.body.authToken,
      topup.body.timeToExpire,
      topup.body.adId,
      topup.body.amount,
      topup.body.contractAddress,
    );
    note(`soroban tx ${txFund}`);
    expectStatus(
      await apiConfirm(adId, access, txFund as `0x${string}`),
      200,
      "apiConfirm(fund)",
    );
  });

  await step("withdraw (-1 XLM)", async () => {
    const withdraw = expectStatus(
      await apiWithdraw(
        adId,
        access,
        toBaseUnits("1", "STELLAR"),
        adCreator.publicKey(),
      ),
      200,
      "apiWithdraw",
    );
    const txW = await withdrawFromAdSoroban(
      adCreator,
      withdraw.body.signature,
      withdraw.body.signerPublicKey,
      withdraw.body.authToken,
      withdraw.body.timeToExpire,
      withdraw.body.adId,
      withdraw.body.amount,
      StrKey.isValidEd25519PublicKey(withdraw.body.to)
        ? withdraw.body.to
        : adCreator.publicKey(),
      withdraw.body.contractAddress,
    );
    note(`soroban tx ${txW}`);
    expectStatus(
      await apiConfirm(adId, access, txW as `0x${string}`),
      200,
      "apiConfirm(withdraw)",
    );
  });

  await step("close ad", async () => {
    const close = expectStatus(
      await apiCloseAd(adId, access, { to: adCreator.publicKey() }),
      200,
      "apiCloseAd",
    );
    const txClose = await closeAdSoroban(
      adCreator,
      close.body.signature,
      close.body.signerPublicKey,
      close.body.authToken,
      close.body.timeToExpire,
      close.body.adId,
      StrKey.isValidEd25519PublicKey(close.body.to)
        ? close.body.to
        : adCreator.publicKey(),
      close.body.contractAddress,
    );
    note(`soroban tx ${txClose}`);
    expectStatus(
      await apiConfirm(adId, access, txClose as `0x${string}`),
      200,
      "apiConfirm(close)",
    );
  });

  await step("verify ad CLOSED", async () => {
    const finalAd = expectStatus(await apiGetAd(adId), 200, "apiGetAd(final)");
    assertObject(finalAd.body, { status: "CLOSED", poolAmount: "0" });
  });

  console.log("[ad-lifecycle] passed");
}
