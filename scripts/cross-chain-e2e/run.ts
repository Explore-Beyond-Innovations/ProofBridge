/**
 * Cross-chain E2E test runner.
 *
 * Deploys ProofBridge on a local Stellar network (ad chain) and Anvil (EVM
 * order chain), then exercises the full cross-chain bridge flow.
 *
 * Four actors drive the flow (all provisioned by scripts/start_chains.sh):
 *   1. stellarAdmin  — configures AdManager on Stellar; ed25519 key signs
 *                      manager pre-auth for create_ad / lock_for_order / unlock.
 *   2. evmAdmin      — configures OrderPortal on EVM; ECDSA key signs manager
 *                      pre-auth for createOrder / unlock.
 *   3. adCreator     — primary on Stellar (creates ad + authorizes SAC pull).
 *                      Supplies an EVM address to receive tokens on unlock.
 *   4. orderCreator  — primary on EVM (creates the order, pays test tokens).
 *      (bridger)       Supplies a Stellar identity whose key is in the CLI
 *                      keystore so unlock's order_recipient.require_auth()
 *                      auto-signs.
 */

import * as path from "path";
import { ethers } from "ethers";
import {
  invokeContract,
  getAddress,
  getSecret,
  base32Decode,
  strkeyToHex,
  evmAddressToBytes32,
} from "./lib/stellar.js";
import { NonceTracker, getContract } from "./lib/evm.js";
import {
  deployStellarChain,
  deployEvmChain,
  linkChains,
} from "./lib/deploy.js";
import {
  AuthTokenCounter,
  signEd25519,
  createAdRequestHash,
  lockForOrderRequestHash,
  unlockOrderRequestHash,
  evmCreateOrderRequestHash,
  evmUnlockOrderRequestHash,
  evmSignRequest,
} from "./lib/signing.js";
import {
  generateProofs,
  computeOrderHash,
  type OrderParams,
} from "./lib/proof.js";

// ── environment ─────────────────────────────────────────────────────

const ROOT_DIR = process.env.ROOT_DIR!;
const EVM_RPC_URL = process.env.EVM_RPC_URL!;
const EVM_ADMIN_PRIVATE_KEY = process.env.EVM_ADMIN_PRIVATE_KEY!;
const EVM_ORDER_CREATOR_PRIVATE_KEY =
  process.env.EVM_ORDER_CREATOR_PRIVATE_KEY!;
const STELLAR_AD_CREATOR_ACCOUNT = process.env.STELLAR_AD_CREATOR_ACCOUNT!;
const STELLAR_ORDER_CREATOR_ACCOUNT =
  process.env.STELLAR_ORDER_CREATOR_ACCOUNT!;
const AD_CREATOR_EVM_RECIPIENT = process.env.AD_CREATOR_EVM_RECIPIENT!;

const STELLAR_CHAIN_ID = 1000001n;
const EVM_CHAIN_ID = 31337n; // Anvil default

const WASM_DIR = path.join(
  ROOT_DIR,
  "contracts/stellar/target/wasm32v1-none/release",
);
const VK_PATH = path.join(ROOT_DIR, "proof_circuits/deposits/target/vk");
const CIRCUIT_PATH = path.join(
  ROOT_DIR,
  "proof_circuits/deposits/target/deposit_circuit.json",
);

const AD_ID = "e2e-test-ad";
// Ad-chain side: Stellar SAC uses 7-decimal stroops.
const AD_DECIMALS = 7;
const AMOUNT = 1_000_000_000n; // 100 XLM (stroops have 7 decimals)
const ORDER_DECIMALS = 18;
const ORDER_AMOUNT = AMOUNT * 10n ** BigInt(ORDER_DECIMALS - AD_DECIMALS);
const SALT = 42n;

// ── helpers ─────────────────────────────────────────────────────────

function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex.replace(/^0x/i, ""), "hex");
}

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

function phase(n: number, title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Phase ${n}: ${title}`);
  console.log(`${"=".repeat(60)}\n`);
}

/** Format a stroops i128 value as a human-readable XLM string. */
function xlm(stroops: bigint): string {
  const neg = stroops < 0n;
  const abs = neg ? -stroops : stroops;
  const whole = abs / 10_000_000n;
  const frac = abs % 10_000_000n;
  const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${fracStr ? "." + fracStr : ""} XLM`;
}

/** Read an account's balance on a Stellar token (SAC). */
function stellarTokenBalance(sac: string, account: string): bigint {
  const out = invokeContract(sac, "balance", [`--id`, account], {
    send: false,
  });
  // stellar CLI prints the i128 as the last non-empty line, possibly quoted.
  const last = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .pop()!;
  return BigInt(last.replace(/^"|"$/g, ""));
}

// ── main ────────────────────────────────────────────────────────────

async function main() {
  console.log("Cross-Chain E2E Test");
  console.log(`  Stellar chain ID: ${STELLAR_CHAIN_ID}`);
  console.log(`  EVM chain ID:     ${EVM_CHAIN_ID}`);
  console.log(`  EVM RPC:          ${EVM_RPC_URL}`);

  // ── actors ─────────────────────────────────────────────────────────

  // Stellar admin — default CLI source + manager pre-auth signer.
  const stellarAdmin = getAddress();
  const stellarAdminSecret = base32Decode(getSecret()).slice(1, 33);
  const stellarAdminSecretKey = Buffer.from(stellarAdminSecret);
  const stellarAdminPubKey = Buffer.from(
    (await import("@noble/ed25519")).getPublicKey(stellarAdminSecretKey),
  );

  // Ad creator — Stellar primary, EVM recipient (no key on EVM).
  const adCreatorStellar = getAddress(STELLAR_AD_CREATOR_ACCOUNT);
  const adCreatorStellarHex = strkeyToHex(adCreatorStellar);
  const adCreatorEvmHex = evmAddressToBytes32(AD_CREATOR_EVM_RECIPIENT);

  // Order creator — EVM primary, Stellar recipient (key required for
  // require_auth on unlock; kept in the stellar CLI keystore).
  const orderCreatorStellar = getAddress(STELLAR_ORDER_CREATOR_ACCOUNT);
  const orderCreatorStellarHex = strkeyToHex(orderCreatorStellar);

  const authCounter = new AuthTokenCounter();
  const TIME_TO_EXPIRE = BigInt("18446744073709551615"); // u64::MAX
  const EVM_TIME_TO_EXPIRE = BigInt(
    Math.floor(Date.now() / 1000) + 86400 * 365 * 100,
  );

  console.log(`  Stellar admin:         ${stellarAdmin}`);
  console.log(`  Ad creator (stellar):  ${adCreatorStellar}`);
  console.log(`  Ad creator (evm):      ${AD_CREATOR_EVM_RECIPIENT}`);
  console.log(`  Order creator (xlm):   ${orderCreatorStellar}`);

  // ════════════════════════════════════════════════════════════════
  // Phase 1: Deploy Stellar Contracts (Ad Chain)
  // ════════════════════════════════════════════════════════════════
  phase(1, "Deploy Stellar Contracts (ad chain)");

  const stellarDeploy = deployStellarChain({
    wasmDir: WASM_DIR,
    vkPath: VK_PATH,
    adminStrkey: stellarAdmin,
    chainId: STELLAR_CHAIN_ID,
  });
  const stellarVerifier = stellarDeploy.verifier;
  const stellarMerkle = stellarDeploy.merkleManager;
  // E2E trades the XLM ↔ WXLM pair. Both ends are resolved via pairKey so
  // the rest of this script is agnostic to the other pairs in the snapshot.
  const stellarAdTokenEntry = stellarDeploy.tokens.find(
    (t) => t.pairKey === "xlm",
  );
  if (!stellarAdTokenEntry) {
    throw new Error("[e2e] stellar snapshot missing pairKey=xlm");
  }
  const stellarAdToken = stellarAdTokenEntry.contractId;
  const stellarAdTokenHex = stellarAdTokenEntry.addressHex;
  const stellarAdManager = stellarDeploy.adManager;
  console.log("Stellar contracts deployed and initialized.");

  // Snapshot XLM balances before any contract movement so we can assert
  // deltas at the end: ad creator should lose AMOUNT (locked in the ad),
  // order creator should gain AMOUNT (received on Stellar unlock).
  const adCreatorXlmBefore = stellarTokenBalance(
    stellarAdToken,
    adCreatorStellar,
  );
  const orderCreatorXlmBefore = stellarTokenBalance(
    stellarAdToken,
    orderCreatorStellar,
  );
  console.log(`  Ad creator XLM (before):    ${xlm(adCreatorXlmBefore)}`);
  console.log(`  Order creator XLM (before): ${xlm(orderCreatorXlmBefore)}`);

  // ════════════════════════════════════════════════════════════════
  // Phase 2: Deploy EVM Contracts (Order Chain)
  // ════════════════════════════════════════════════════════════════
  phase(2, "Deploy EVM Contracts (order chain)");

  const evmDeploy = await deployEvmChain({
    rpcUrl: EVM_RPC_URL,
    adminPrivateKey: EVM_ADMIN_PRIVATE_KEY,
    chainId: EVM_CHAIN_ID,
  });
  const evm = evmDeploy.contracts;
  const evmSigner = evm.signer;
  const nonces = evm.nonces;
  const evmAdmin = await evmSigner.getAddress();
  const provider = evmSigner.provider!;

  console.log(`  EVM admin/manager: ${evmAdmin}`);

  // Order creator's EVM wallet — owns its own nonce tracker.
  const orderCreatorWallet = new ethers.Wallet(
    EVM_ORDER_CREATOR_PRIVATE_KEY,
    provider,
  );
  const orderCreatorNonces = new NonceTracker(orderCreatorWallet);
  await orderCreatorNonces.init();
  const orderCreatorEvm = await orderCreatorWallet.getAddress();
  const orderCreatorEvmHex = evmAddressToBytes32(orderCreatorEvm);
  console.log(`  Order creator:     ${orderCreatorEvm}`);

  // OrderPortal + TestToken instances bound to the order creator — used
  // for approve + createOrder so msg.sender is the order creator.
  const orderPortalAsCreator = getContract(
    evm.addresses.orderPortal,
    "OrderPortal",
    "OrderPortal",
    orderCreatorWallet,
  );
  // EVM counterpart of the XLM pair (WXLM ERC20).
  const evmOrderTokenEntry = evm.tokens.find((t) => t.pairKey === "xlm");
  if (
    !evmOrderTokenEntry ||
    evmOrderTokenEntry.kind !== "ERC20" ||
    !evmOrderTokenEntry.contract
  ) {
    throw new Error("[e2e] evm snapshot missing ERC20 token for pairKey=xlm");
  }
  const evmOrderToken = evmOrderTokenEntry.contract;
  const evmOrderTokenAddress = evmOrderTokenEntry.address;
  const testTokenAsCreator = getContract(
    evmOrderTokenAddress,
    "MockERC20",
    "MockERC20",
    orderCreatorWallet,
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 3: Cross-Chain Linking
  // ════════════════════════════════════════════════════════════════
  phase(3, "Cross-Chain Linking");

  await linkChains(stellarDeploy, evmDeploy);

  const stellarAdManagerHex = stellarDeploy.adManagerHex;
  const stellarAdManagerBuf = hexToBuffer(stellarAdManagerHex);
  const evmOrderPortalBytes32 = evmAddressToBytes32(evm.addresses.orderPortal);
  const evmTokenBytes32 = evmAddressToBytes32(evmOrderTokenAddress);

  // ════════════════════════════════════════════════════════════════
  // Phase 4: Create Ad on Stellar
  // ════════════════════════════════════════════════════════════════
  phase(4, "Create Ad on Stellar");

  const adTokenBuf = hexToBuffer(stellarAdTokenHex);

  {
    const authToken = authCounter.next();
    const msgHash = createAdRequestHash(
      authToken,
      TIME_TO_EXPIRE,
      AD_ID,
      adTokenBuf,
      AMOUNT,
      EVM_CHAIN_ID,
      hexToBuffer(adCreatorEvmHex),
      STELLAR_CHAIN_ID,
      stellarAdManagerBuf,
    );
    const sig = signEd25519(msgHash, stellarAdminSecretKey);

    // Ad creator is tx source — authorizes the SAC transfer via require_auth.
    invokeContract(
      stellarAdManager,
      "create_ad",
      [
        `--signature`,
        sig.toString("hex"),
        `--public_key`,
        stellarAdminPubKey.toString("hex"),
        `--auth_token`,
        authToken.toString("hex"),
        `--time_to_expire`,
        TIME_TO_EXPIRE.toString(),
        `--creator`,
        adCreatorStellar,
        `--ad_id`,
        AD_ID,
        `--ad_token`,
        stellarAdTokenHex.replace(/^0x/, ""),
        `--initial_amount`,
        AMOUNT.toString(),
        `--order_chain_id`,
        EVM_CHAIN_ID.toString(),
        `--ad_recipient`,
        adCreatorEvmHex.replace(/^0x/, ""),
      ],
      { source: STELLAR_AD_CREATOR_ACCOUNT },
    );
  }

  console.log(`Ad "${AD_ID}" created on Stellar by ad creator.`);

  // ════════════════════════════════════════════════════════════════
  // Phase 5: Create Order on EVM
  // ════════════════════════════════════════════════════════════════
  phase(5, "Create Order on EVM");

  // Admin mints test tokens to the order creator; the order creator then
  // approves OrderPortal and calls createOrder as msg.sender.
  console.log("Minting order token to order creator...");
  {
    const tx = await evmOrderToken.getFunction("mint")(
      orderCreatorEvm,
      ORDER_AMOUNT * 10n,
      { nonce: nonces.next() },
    );
    await tx.wait();
  }

  console.log("Order creator approving OrderPortal...");
  {
    const tx = await testTokenAsCreator.getFunction("approve")(
      evm.addresses.orderPortal,
      ORDER_AMOUNT,
      { nonce: orderCreatorNonces.next() },
    );
    await tx.wait();
  }

  const evmOrderParams = {
    orderChainToken: evmTokenBytes32,
    adChainToken: stellarAdTokenHex,
    amount: ORDER_AMOUNT,
    bridger: orderCreatorEvmHex,
    orderRecipient: orderCreatorStellarHex,
    adChainId: STELLAR_CHAIN_ID,
    adManager: stellarAdManagerHex,
    adId: AD_ID,
    adCreator: adCreatorStellarHex,
    adRecipient: adCreatorEvmHex,
    salt: SALT,
    orderDecimals: ORDER_DECIMALS,
    adDecimals: AD_DECIMALS,
  };

  const orderParams: OrderParams = {
    orderChainToken: evmTokenBytes32,
    adChainToken: stellarAdTokenHex,
    amount: ORDER_AMOUNT,
    bridger: orderCreatorEvmHex,
    orderChainId: EVM_CHAIN_ID,
    orderPortal: evmOrderPortalBytes32,
    orderRecipient: orderCreatorStellarHex,
    adChainId: STELLAR_CHAIN_ID,
    adManager: stellarAdManagerHex,
    adId: AD_ID,
    adCreator: adCreatorStellarHex,
    adRecipient: adCreatorEvmHex,
    salt: SALT,
    orderDecimals: ORDER_DECIMALS,
    adDecimals: AD_DECIMALS,
  };

  const orderHash = computeOrderHash(orderParams);
  console.log(`  Order hash: ${orderHash}`);

  console.log("Signing createOrder pre-auth (evm admin)...");
  const evmAuthToken1 = "0x" + "0".repeat(62) + "a1";
  const createOrderMsgHash = evmCreateOrderRequestHash(
    AD_ID,
    orderHash,
    evmAuthToken1,
    EVM_TIME_TO_EXPIRE,
    EVM_CHAIN_ID,
    evm.addresses.orderPortal,
  );
  const createOrderSig = await evmSignRequest(createOrderMsgHash, evmSigner);

  console.log("Order creator submitting createOrder...");
  {
    const tx = await orderPortalAsCreator.getFunction("createOrder")(
      createOrderSig,
      evmAuthToken1,
      EVM_TIME_TO_EXPIRE,
      evmOrderParams,
      { nonce: orderCreatorNonces.next() },
    );
    const receipt = await tx.wait();
    console.log(`  createOrder tx: ${receipt.hash}`);
  }

  const orderStatus = await evm.orderPortal.getFunction("orders")(orderHash);
  assert(orderStatus === 1n, `Order should be Open (1), got ${orderStatus}`);
  console.log("Order created and funded on EVM.");

  // ════════════════════════════════════════════════════════════════
  // Phase 6: Lock Order on Stellar
  // ════════════════════════════════════════════════════════════════
  phase(6, "Lock Order on Stellar");

  const stellarOrderParams = {
    order_chain_token: evmTokenBytes32.replace(/^0x/, ""),
    ad_chain_token: stellarAdTokenHex.replace(/^0x/, ""),
    amount: ORDER_AMOUNT.toString(),
    bridger: orderCreatorEvmHex.replace(/^0x/, ""),
    order_chain_id: EVM_CHAIN_ID.toString(),
    src_order_portal: evmOrderPortalBytes32.replace(/^0x/, ""),
    order_recipient: orderCreatorStellarHex.replace(/^0x/, ""),
    ad_id: AD_ID,
    ad_creator: adCreatorStellarHex.replace(/^0x/, ""),
    ad_recipient: adCreatorEvmHex.replace(/^0x/, ""),
    salt: SALT.toString(),
    order_decimals: ORDER_DECIMALS,
    ad_decimals: AD_DECIMALS,
  };

  const stellarOrderParamsJson = JSON.stringify(stellarOrderParams);

  {
    const authToken = authCounter.next();
    const orderHashBuf = hexToBuffer(orderHash);
    const msgHash = lockForOrderRequestHash(
      authToken,
      TIME_TO_EXPIRE,
      AD_ID,
      orderHashBuf,
      STELLAR_CHAIN_ID,
      stellarAdManagerBuf,
    );
    const sig = signEd25519(msgHash, stellarAdminSecretKey);

    // Source = ad creator so ad.maker.require_auth() is auto-signed.
    invokeContract(
      stellarAdManager,
      "lock_for_order",
      [
        `--signature`,
        sig.toString("hex"),
        `--public_key`,
        stellarAdminPubKey.toString("hex"),
        `--auth_token`,
        authToken.toString("hex"),
        `--time_to_expire`,
        TIME_TO_EXPIRE.toString(),
        `--params`,
        stellarOrderParamsJson,
      ],
      { source: STELLAR_AD_CREATOR_ACCOUNT },
    );
  }

  console.log("Order locked on Stellar AdManager.");

  // ════════════════════════════════════════════════════════════════
  // Phase 7: Generate ZK Proofs
  // ════════════════════════════════════════════════════════════════
  phase(7, "Generate ZK Proofs");

  const proofResult = await generateProofs(orderParams, CIRCUIT_PATH);

  console.log(`  Order hash:           ${proofResult.orderHash}`);
  console.log(`  Target root:          ${proofResult.targetRoot}`);
  console.log(`  Bridger nullifier:    ${proofResult.bridgerNullifier}`);
  console.log(`  Ad-creator nullifier: ${proofResult.adCreatorNullifier}`);
  console.log(
    `  Bridger proof:        ${proofResult.bridgerProof.length} bytes`,
  );
  console.log(
    `  Ad-creator proof:     ${proofResult.adCreatorProof.length} bytes`,
  );

  // ════════════════════════════════════════════════════════════════
  // Phase 8: Order Creator Unlocks on Stellar (ad chain)
  // ════════════════════════════════════════════════════════════════
  phase(8, "Order Creator Unlocks on Stellar");

  {
    const authToken = authCounter.next();
    const orderHashBuf = hexToBuffer(orderHash);
    const targetRootBuf = hexToBuffer(proofResult.targetRoot);
    const msgHash = unlockOrderRequestHash(
      authToken,
      TIME_TO_EXPIRE,
      AD_ID,
      orderHashBuf,
      targetRootBuf,
      STELLAR_CHAIN_ID,
      stellarAdManagerBuf,
    );
    const sig = signEd25519(msgHash, stellarAdminSecretKey);

    const proofHex = Buffer.from(proofResult.bridgerProof).toString("hex");
    const nullifierHex = proofResult.bridgerNullifier
      .toString()
      .replace(/^0x/, "");

    // Source = order creator (Stellar identity) so order_recipient.require_auth()
    // is auto-signed on the unlock.
    invokeContract(
      stellarAdManager,
      "unlock",
      [
        `--signature`,
        sig.toString("hex"),
        `--public_key`,
        stellarAdminPubKey.toString("hex"),
        `--auth_token`,
        authToken.toString("hex"),
        `--time_to_expire`,
        TIME_TO_EXPIRE.toString(),
        `--params`,
        stellarOrderParamsJson,
        `--nullifier_hash`,
        nullifierHex,
        `--target_root`,
        proofResult.targetRoot.replace(/^0x/, ""),
        `--proof`,
        proofHex,
      ],
      { source: STELLAR_ORDER_CREATOR_ACCOUNT },
    );
  }

  console.log("Order creator unlocked on Stellar — XLM released.");

  // ════════════════════════════════════════════════════════════════
  // Phase 9: Ad Creator Unlocks on EVM (order chain)
  // ════════════════════════════════════════════════════════════════
  phase(9, "Ad Creator Unlocks on EVM");

  {
    const evmAuthToken2 = "0x" + "0".repeat(62) + "a2";
    const nullifierHash = proofResult.adCreatorNullifier.toString();
    const targetRoot = proofResult.targetRoot;

    const unlockMsgHash = evmUnlockOrderRequestHash(
      AD_ID,
      orderHash,
      targetRoot,
      evmAuthToken2,
      EVM_TIME_TO_EXPIRE,
      EVM_CHAIN_ID,
      evm.addresses.orderPortal,
    );
    const unlockSig = await evmSignRequest(unlockMsgHash, evmSigner);

    const proofHex =
      "0x" + Buffer.from(proofResult.adCreatorProof).toString("hex");

    console.log("Calling EVM OrderPortal.unlock...");
    const tx = await evm.orderPortal.getFunction("unlock")(
      unlockSig,
      evmAuthToken2,
      EVM_TIME_TO_EXPIRE,
      evmOrderParams,
      nullifierHash,
      targetRoot,
      proofHex,
      { nonce: nonces.next() },
    );
    const receipt = await tx.wait();
    console.log(`  unlock tx: ${receipt.hash}`);
  }

  const finalStatus = await evm.orderPortal.getFunction("orders")(orderHash);
  assert(finalStatus === 2n, `Order should be Filled (2), got ${finalStatus}`);
  console.log("Ad creator unlocked on EVM — tokens released to EVM recipient.");

  // ════════════════════════════════════════════════════════════════
  // Phase 10: Assertions & Summary
  // ════════════════════════════════════════════════════════════════
  phase(10, "Assertions & Summary");

  const adCreatorNullUsed = await evm.orderPortal.getFunction("nullifierUsed")(
    proofResult.adCreatorNullifier.toString(),
  );
  assert(adCreatorNullUsed, "Ad-creator nullifier should be consumed on EVM");

  // EVM token accounting (order-chain decimals):
  //   order creator: minted 10*ORDER_AMOUNT, spent ORDER_AMOUNT on createOrder
  //                  → 9*ORDER_AMOUNT remaining
  //   ad creator (EVM recipient): 0 → ORDER_AMOUNT after unlock
  const orderCreatorBalance =
    await evmOrderToken.getFunction("balanceOf")(orderCreatorEvm);
  const adRecipientBalance = await evmOrderToken.getFunction("balanceOf")(
    AD_CREATOR_EVM_RECIPIENT,
  );

  console.log(
    `  Order creator EVM token balance:  ${orderCreatorBalance} (expected ${ORDER_AMOUNT * 9n})`,
  );
  console.log(
    `  Ad creator EVM token balance:     ${adRecipientBalance} (expected ${ORDER_AMOUNT})`,
  );

  assert(
    orderCreatorBalance === ORDER_AMOUNT * 9n,
    `Order creator EVM balance: expected ${ORDER_AMOUNT * 9n}, got ${orderCreatorBalance}`,
  );
  assert(
    adRecipientBalance === ORDER_AMOUNT,
    `Ad creator EVM recipient did not receive order token: expected ${ORDER_AMOUNT}, got ${adRecipientBalance}`,
  );
  console.log("  ✓ Ad creator EVM recipient received the order token.");

  // Stellar XLM accounting — allow small slop for network fees (both
  // accounts were the source of at least one tx).
  const adCreatorXlmAfter = stellarTokenBalance(
    stellarAdToken,
    adCreatorStellar,
  );
  const orderCreatorXlmAfter = stellarTokenBalance(
    stellarAdToken,
    orderCreatorStellar,
  );
  const adCreatorDelta = adCreatorXlmBefore - adCreatorXlmAfter; // positive: spent
  const orderCreatorDelta = orderCreatorXlmAfter - orderCreatorXlmBefore; // positive: received
  const FEE_SLOP = 10_000_000n; // 1 XLM — generous ceiling for localnet fees

  // Derive the fees each account paid from the observed deltas.
  //   Ad creator: spent AMOUNT locking the ad + fees for create_ad + lock_for_order.
  //   Order creator: received AMOUNT from unlock, paid the (expensive) unlock fee.
  const adCreatorFees = adCreatorDelta - AMOUNT;
  const orderCreatorFees = AMOUNT - orderCreatorDelta;

  console.log("");
  console.log(
    `  Ad creator:    locked -${xlm(AMOUNT)} into ad, paid ~${xlm(adCreatorFees)} in fees (create_ad + lock_for_order) → net -${xlm(adCreatorDelta)}.`,
  );
  console.log(
    `  Order creator: received +${xlm(AMOUNT)} from the contract, paid ~${xlm(orderCreatorFees)} in fees for the unlock tx → net ${orderCreatorDelta >= 0n ? "+" : ""}${xlm(orderCreatorDelta)}.`,
  );

  assert(
    adCreatorDelta >= AMOUNT && adCreatorDelta <= AMOUNT + FEE_SLOP,
    `Ad creator should have spent ~${xlm(AMOUNT)} (incl. fees), spent ${xlm(adCreatorDelta)}`,
  );
  assert(
    orderCreatorDelta <= AMOUNT && AMOUNT - orderCreatorDelta <= FEE_SLOP,
    `Order creator did not receive order amount: expected ~${xlm(AMOUNT)} (minus fees), got ${xlm(orderCreatorDelta)}`,
  );
  console.log("  ✓ Order creator Stellar address received the order amount.");

  console.log("\nCross-chain E2E test completed successfully!");
  console.log("");
  console.log("Stellar Contracts:");
  console.log(`  Verifier:       ${stellarVerifier}`);
  console.log(`  MerkleManager:  ${stellarMerkle}`);
  console.log(`  AdManager:      ${stellarAdManager}`);
  console.log("");
  console.log("EVM Contracts:");
  console.log(`  Verifier:       ${evm.addresses.verifier}`);
  console.log(`  MerkleManager:  ${evm.addresses.merkleManager}`);
  console.log(`  OrderPortal:    ${evm.addresses.orderPortal}`);
  console.log(
    `  OrderToken:     ${evmOrderTokenAddress} (${evmOrderTokenEntry.symbol})`,
  );
  console.log("");
  console.log("Order hash:", orderHash);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n\nCross-chain E2E test FAILED:", err);
    process.exit(1);
  });
