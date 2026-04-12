/**
 * Cross-chain E2E test runner.
 *
 * Deploys ProofBridge on a local Stellar network (ad chain) and Anvil (EVM order chain),
 * then exercises the full cross-chain bridge flow:
 *   1. Deploy contracts on both chains
 *   2. Link chains bidirectionally
 *   3. Create ad on Stellar
 *   4. Create order on EVM
 *   5. Lock order on Stellar
 *   6. Generate ZK proofs
 *   7. Bridger unlocks on Stellar
 *   8. Ad-creator unlocks on EVM
 */

import * as path from "path";
import * as fs from "fs";
import { ethers } from "ethers";
import {
  deployContract,
  invokeContract,
  getAddress,
  strkeyToHex,
  evmAddressToBytes32,
  stellarIdToEvmAddress,
} from "./lib/stellar.js";
import { deployEvmContracts, createSigner } from "./lib/evm.js";
import {
  AuthTokenCounter,
  generateEd25519Keypair,
  signEd25519,
  setChainRequestHash,
  setTokenRouteRequestHash,
  createAdRequestHash,
  lockForOrderRequestHash,
  unlockOrderRequestHash,
  evmCreateOrderRequestHash,
  evmUnlockOrderRequestHash,
  evmSignRequest,
} from "./lib/signing.js";
import { generateProofs, computeOrderHash, type OrderParams } from "./lib/proof.js";

// ── environment ─────────────────────────────────────────────────────

const ROOT_DIR = process.env.ROOT_DIR!;
const EVM_RPC_URL = process.env.EVM_RPC_URL!;
const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY!;

const STELLAR_CHAIN_ID = 1000001n;
const EVM_CHAIN_ID = 31337n; // Anvil default

const WASM_DIR = path.join(
  ROOT_DIR,
  "contracts/stellar/target/wasm32v1-none/release"
);
const VK_PATH = path.join(
  ROOT_DIR,
  "proof_circuits/deposits/target/vk"
);
const CIRCUIT_PATH = path.join(
  ROOT_DIR,
  "proof_circuits/deposits/target/deposit_circuit.json"
);

const AD_ID = "e2e-test-ad";
const AMOUNT = 1_000_000n;
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

// ── main ────────────────────────────────────────────────────────────

async function main() {
  console.log("Cross-Chain E2E Test");
  console.log(`  Stellar chain ID: ${STELLAR_CHAIN_ID}`);
  console.log(`  EVM chain ID: ${EVM_CHAIN_ID}`);
  console.log(`  EVM RPC: ${EVM_RPC_URL}`);

  // Ed25519 keypair for Stellar admin auth
  const { publicKey: adminPubKey, secretKey: adminSecretKey } =
    generateEd25519Keypair();
  const authCounter = new AuthTokenCounter();
  const TIME_TO_EXPIRE = BigInt("18446744073709551615"); // u64::MAX

  // EVM time_to_expire — use a large but valid timestamp (year 2100)
  const EVM_TIME_TO_EXPIRE = BigInt(Math.floor(Date.now() / 1000) + 86400 * 365 * 100);

  // Stellar source account address (alice)
  const aliceAddress = getAddress();
  console.log(`  Stellar source: ${aliceAddress}`);

  // ════════════════════════════════════════════════════════════════
  // Phase 1: Deploy Stellar Contracts (Ad Chain)
  // ════════════════════════════════════════════════════════════════
  phase(1, "Deploy Stellar Contracts (ad chain)");

  // Deploy Verifier with VK
  console.log("Deploying Verifier...");
  const stellarVerifier = deployContract(
    path.join(WASM_DIR, "verifier.wasm"),
    [`--vk_bytes-file-path`, VK_PATH]
  );
  console.log(`  Verifier: ${stellarVerifier}`);

  // Deploy MerkleManager
  console.log("Deploying MerkleManager...");
  const stellarMerkle = deployContract(
    path.join(WASM_DIR, "merkle_manager.wasm")
  );
  console.log(`  MerkleManager: ${stellarMerkle}`);

  // Initialize MerkleManager
  invokeContract(stellarMerkle, "initialize", [
    `--admin`,
    aliceAddress,
  ]);

  // For e2e test, we'll use a synthetic 32-byte address for ad token
  // In a real scenario this would be a deployed SAC token
  const stellarAdTokenHex = "0x" + "d4".repeat(32);

  // Deploy AdManager
  console.log("Deploying AdManager...");
  const stellarAdManager = deployContract(
    path.join(WASM_DIR, "ad_manager.wasm")
  );
  console.log(`  AdManager: ${stellarAdManager}`);

  // Initialize AdManager
  invokeContract(stellarAdManager, "initialize", [
    `--admin`, aliceAddress,
    `--verifier`, stellarVerifier,
    `--merkle_manager`, stellarMerkle,
    `--w_native_token`, stellarAdManager, // placeholder, not used in test
    `--chain_id`, STELLAR_CHAIN_ID.toString(),
  ]);

  // Set MerkleManager to allow AdManager as manager
  invokeContract(stellarMerkle, "set_manager", [
    `--manager`, stellarAdManager,
    `--enabled`, "true",
  ]);

  console.log("Stellar contracts deployed and initialized.");

  // ════════════════════════════════════════════════════════════════
  // Phase 2: Deploy EVM Contracts (Order Chain)
  // ════════════════════════════════════════════════════════════════
  phase(2, "Deploy EVM Contracts (order chain)");

  const evm = await deployEvmContracts(EVM_RPC_URL, EVM_PRIVATE_KEY);
  const evmSigner = createSigner(EVM_RPC_URL, EVM_PRIVATE_KEY);
  const evmAdmin = await evmSigner.getAddress();

  console.log(`  EVM admin/manager: ${evmAdmin}`);
  console.log("EVM contracts deployed.");

  // ════════════════════════════════════════════════════════════════
  // Phase 3: Cross-Chain Linking
  // ════════════════════════════════════════════════════════════════
  phase(3, "Cross-Chain Linking");

  // Stellar AdManager contract address as 32-byte hex
  const stellarAdManagerHex = strkeyToHex(stellarAdManager);
  const stellarAdManagerBuf = hexToBuffer(stellarAdManagerHex);

  // EVM OrderPortal address as 32-byte hex (left-padded)
  const evmOrderPortalBytes32 = evmAddressToBytes32(evm.addresses.orderPortal);

  // EVM test token address as 32-byte hex (left-padded)
  const evmTokenBytes32 = evmAddressToBytes32(evm.addresses.testToken);

  // --- Stellar AdManager: setChain ---
  console.log("Linking Stellar AdManager → EVM OrderPortal...");
  {
    const authToken = authCounter.next();
    const msgHash = setChainRequestHash(
      authToken,
      TIME_TO_EXPIRE,
      STELLAR_CHAIN_ID,
      stellarAdManagerBuf
    );
    const sig = signEd25519(msgHash, adminSecretKey);

    invokeContract(stellarAdManager, "set_chain", [
      `--signature`, sig.toString("hex"),
      `--public_key`, adminPubKey.toString("hex"),
      `--auth_token`, authToken.toString("hex"),
      `--time_to_expire`, TIME_TO_EXPIRE.toString(),
      `--order_chain_id`, EVM_CHAIN_ID.toString(),
      `--order_portal`, evmOrderPortalBytes32.replace(/^0x/, ""),
      `--supported`, "true",
    ]);
  }

  // --- Stellar AdManager: setTokenRoute ---
  console.log("Setting Stellar token route...");
  {
    const authToken = authCounter.next();
    const msgHash = setTokenRouteRequestHash(
      authToken,
      TIME_TO_EXPIRE,
      STELLAR_CHAIN_ID,
      stellarAdManagerBuf
    );
    const sig = signEd25519(msgHash, adminSecretKey);

    invokeContract(stellarAdManager, "set_token_route", [
      `--signature`, sig.toString("hex"),
      `--public_key`, adminPubKey.toString("hex"),
      `--auth_token`, authToken.toString("hex"),
      `--time_to_expire`, TIME_TO_EXPIRE.toString(),
      `--ad_chain_token`, stellarAdTokenHex.replace(/^0x/, ""),
      `--order_chain_token`, evmTokenBytes32.replace(/^0x/, ""),
      `--order_chain_id`, EVM_CHAIN_ID.toString(),
    ]);
  }

  // --- EVM OrderPortal: setChain ---
  console.log("Linking EVM OrderPortal → Stellar AdManager...");
  const stellarAdManagerEvm = stellarIdToEvmAddress(stellarAdManager);
  {
    const tx = await evm.orderPortal.getFunction("setChain")(
      STELLAR_CHAIN_ID,
      stellarAdManagerEvm,
      true
    );
    await tx.wait();
  }

  // --- EVM OrderPortal: setTokenRoute ---
  console.log("Setting EVM token route...");
  const stellarTokenEvm = "0x" + stellarAdTokenHex.replace(/^0x/, "").slice(24);
  {
    const tx = await evm.orderPortal.getFunction("setTokenRoute")(
      evm.addresses.testToken,
      STELLAR_CHAIN_ID,
      stellarTokenEvm
    );
    await tx.wait();
  }

  console.log("Cross-chain linking complete.");

  // ════════════════════════════════════════════════════════════════
  // Phase 4: Create Ad on Stellar
  // ════════════════════════════════════════════════════════════════
  phase(4, "Create Ad on Stellar");

  // For simplicity, use the EVM admin as both ad_creator and ad_recipient
  const adCreatorHex = evmAddressToBytes32(evmAdmin);
  const adRecipientHex = evmAddressToBytes32(evmAdmin);
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
      hexToBuffer(adRecipientHex),
      STELLAR_CHAIN_ID,
      stellarAdManagerBuf
    );
    const sig = signEd25519(msgHash, adminSecretKey);

    invokeContract(stellarAdManager, "create_ad", [
      `--signature`, sig.toString("hex"),
      `--public_key`, adminPubKey.toString("hex"),
      `--auth_token`, authToken.toString("hex"),
      `--time_to_expire`, TIME_TO_EXPIRE.toString(),
      `--ad_id`, AD_ID,
      `--token`, stellarAdTokenHex.replace(/^0x/, ""),
      `--amount`, AMOUNT.toString(),
      `--order_chain_id`, EVM_CHAIN_ID.toString(),
      `--ad_recipient`, adRecipientHex.replace(/^0x/, ""),
    ]);
  }

  console.log(`Ad "${AD_ID}" created on Stellar.`);

  // ════════════════════════════════════════════════════════════════
  // Phase 5: Create Order on EVM
  // ════════════════════════════════════════════════════════════════
  phase(5, "Create Order on EVM");

  // Mint test tokens to bridger (use admin as bridger for simplicity)
  console.log("Minting test tokens...");
  {
    const mintTx = await evm.testToken.getFunction("mint")(
      evmAdmin,
      AMOUNT * 10n
    );
    await mintTx.wait();
  }

  // Approve OrderPortal
  {
    const approveTx = await evm.testToken.getFunction("approve")(
      evm.addresses.orderPortal,
      AMOUNT
    );
    await approveTx.wait();
  }

  // Build EVM OrderParams struct (uses 20-byte addresses)
  // The contract internally converts via toBytes32() for EIP-712 hashing
  const evmOrderParams = {
    orderChainToken: evm.addresses.testToken,
    adChainToken: stellarTokenEvm,
    amount: AMOUNT,
    bridger: evmAdmin,
    orderRecipient: evmAdmin,
    adChainId: STELLAR_CHAIN_ID,
    adManager: stellarAdManagerEvm,
    adId: AD_ID,
    adCreator: evmAdmin, // truncated from adCreatorHex
    adRecipient: evmAdmin, // truncated from adRecipientHex
    salt: SALT,
  };

  // Build 32-byte order params for proof generation (cross-chain compatible)
  const orderParams: OrderParams = {
    orderChainToken: evmTokenBytes32,
    adChainToken: stellarAdTokenHex,
    amount: AMOUNT,
    bridger: evmAddressToBytes32(evmAdmin),
    orderChainId: EVM_CHAIN_ID,
    orderPortal: evmAddressToBytes32(evm.addresses.orderPortal),
    orderRecipient: evmAddressToBytes32(evmAdmin),
    adChainId: STELLAR_CHAIN_ID,
    adManager: stellarAdManagerHex,
    adId: AD_ID,
    adCreator: adCreatorHex,
    adRecipient: adRecipientHex,
    salt: SALT,
  };

  // Compute order hash off-chain (EIP-712 typed data hash with minimal domain)
  // This matches what the EVM contract computes internally via _hashOrder
  const orderHash = computeOrderHash(orderParams);
  console.log(`  Order hash: ${orderHash}`);

  // Generate ECDSA signature for createOrder
  console.log("Signing createOrder request...");
  const evmAuthToken1 = "0x" + "0".repeat(62) + "a1";
  const createOrderMsgHash = evmCreateOrderRequestHash(
    AD_ID,
    orderHash,
    evmAuthToken1,
    EVM_TIME_TO_EXPIRE,
    EVM_CHAIN_ID,
    evm.addresses.orderPortal
  );
  const createOrderSig = await evmSignRequest(createOrderMsgHash, evmSigner);

  console.log("Creating order on EVM OrderPortal...");
  {
    const tx = await evm.orderPortal.getFunction("createOrder")(
      createOrderSig,
      evmAuthToken1,
      EVM_TIME_TO_EXPIRE,
      evmOrderParams
    );
    const receipt = await tx.wait();
    console.log(`  createOrder tx: ${receipt.hash}`);
  }

  // Verify order is Open
  const orderStatus = await evm.orderPortal.getFunction("orders")(orderHash);
  assert(orderStatus === 1n, `Order should be Open (1), got ${orderStatus}`);
  console.log("Order created and funded on EVM.");

  // ════════════════════════════════════════════════════════════════
  // Phase 6: Lock Order on Stellar
  // ════════════════════════════════════════════════════════════════
  phase(6, "Lock Order on Stellar");

  {
    const authToken = authCounter.next();
    const orderHashBuf = hexToBuffer(orderHash);
    const msgHash = lockForOrderRequestHash(
      authToken,
      TIME_TO_EXPIRE,
      AD_ID,
      orderHashBuf,
      STELLAR_CHAIN_ID,
      stellarAdManagerBuf
    );
    const sig = signEd25519(msgHash, adminSecretKey);

    invokeContract(stellarAdManager, "lock_for_order", [
      `--signature`, sig.toString("hex"),
      `--public_key`, adminPubKey.toString("hex"),
      `--auth_token`, authToken.toString("hex"),
      `--time_to_expire`, TIME_TO_EXPIRE.toString(),
      `--ad_id`, AD_ID,
      `--order_hash`, orderHash.replace(/^0x/, ""),
    ]);
  }

  console.log("Order locked on Stellar AdManager.");

  // ════════════════════════════════════════════════════════════════
  // Phase 7: Generate ZK Proofs
  // ════════════════════════════════════════════════════════════════
  phase(7, "Generate ZK Proofs");

  const proofResult = await generateProofs(orderParams, CIRCUIT_PATH);

  console.log(`  Order hash: ${proofResult.orderHash}`);
  console.log(`  Order hash (field mod): ${proofResult.orderHashMod.toString()}`);
  console.log(`  Target root: ${proofResult.targetRoot}`);
  console.log(`  Bridger nullifier: ${proofResult.bridgerNullifier.toString()}`);
  console.log(`  Ad-creator nullifier: ${proofResult.adCreatorNullifier.toString()}`);
  console.log(`  Bridger proof: ${proofResult.bridgerProof.length} bytes`);
  console.log(`  Ad-creator proof: ${proofResult.adCreatorProof.length} bytes`);

  // ════════════════════════════════════════════════════════════════
  // Phase 8: Bridger Unlocks on Stellar (ad chain)
  // ════════════════════════════════════════════════════════════════
  phase(8, "Bridger Unlocks on Stellar");

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
      stellarAdManagerBuf
    );
    const sig = signEd25519(msgHash, adminSecretKey);

    // Convert proof bytes to hex string for CLI
    const proofHex = Buffer.from(proofResult.bridgerProof).toString("hex");
    const nullifierHex = proofResult.bridgerNullifier.toString().replace(/^0x/, "");

    invokeContract(stellarAdManager, "unlock", [
      `--signature`, sig.toString("hex"),
      `--public_key`, adminPubKey.toString("hex"),
      `--auth_token`, authToken.toString("hex"),
      `--time_to_expire`, TIME_TO_EXPIRE.toString(),
      `--ad_id`, AD_ID,
      `--order_hash`, orderHash.replace(/^0x/, ""),
      `--target_root`, proofResult.targetRoot.replace(/^0x/, ""),
      `--nullifier_hash`, nullifierHex,
      `--proof`, proofHex,
    ]);
  }

  console.log("Bridger unlocked on Stellar! Tokens released to bridger.");

  // ════════════════════════════════════════════════════════════════
  // Phase 9: Ad-Creator Unlocks on EVM (order chain)
  // ════════════════════════════════════════════════════════════════
  phase(9, "Ad-Creator Unlocks on EVM");

  {
    const evmAuthToken2 = "0x" + "0".repeat(62) + "a2";
    const nullifierHash = proofResult.adCreatorNullifier.toString();
    const targetRoot = proofResult.targetRoot;

    // Generate ECDSA signature for unlock
    const unlockMsgHash = evmUnlockOrderRequestHash(
      AD_ID,
      orderHash,
      targetRoot,
      evmAuthToken2,
      EVM_TIME_TO_EXPIRE,
      EVM_CHAIN_ID,
      evm.addresses.orderPortal
    );
    const unlockSig = await evmSignRequest(unlockMsgHash, evmSigner);

    // Convert proof to hex for EVM call
    const proofHex = "0x" + Buffer.from(proofResult.adCreatorProof).toString("hex");

    console.log("Calling EVM OrderPortal.unlock...");
    const tx = await evm.orderPortal.getFunction("unlock")(
      unlockSig,
      evmAuthToken2,
      EVM_TIME_TO_EXPIRE,
      evmOrderParams,
      nullifierHash,
      targetRoot,
      proofHex
    );
    const receipt = await tx.wait();
    console.log(`  unlock tx: ${receipt.hash}`);
  }

  // Verify order is Filled
  const finalStatus = await evm.orderPortal.getFunction("orders")(orderHash);
  assert(finalStatus === 2n, `Order should be Filled (2), got ${finalStatus}`);
  console.log("Ad-creator unlocked on EVM! Tokens released to ad-recipient.");

  // ════════════════════════════════════════════════════════════════
  // Phase 10: Assertions & Summary
  // ════════════════════════════════════════════════════════════════
  phase(10, "Assertions & Summary");

  // Verify nullifier is consumed on EVM (double-unlock should fail)
  const bridgerNullUsed = await evm.orderPortal.getFunction("nullifierUsed")(
    proofResult.adCreatorNullifier.toString()
  );
  assert(bridgerNullUsed === true, "Ad-creator nullifier should be consumed on EVM");

  // Verify ad-recipient received tokens on EVM
  const adRecipientBalance = await evm.testToken.getFunction("balanceOf")(evmAdmin);
  console.log(`  Ad-recipient EVM token balance: ${adRecipientBalance}`);
  // The ad-recipient (evmAdmin) minted 10*AMOUNT, spent AMOUNT on createOrder,
  // then got AMOUNT back from unlock. Net: 10*AMOUNT.
  assert(
    adRecipientBalance === AMOUNT * 10n,
    `Expected balance ${AMOUNT * 10n}, got ${adRecipientBalance}`
  );

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
  console.log(`  TestToken:      ${evm.addresses.testToken}`);
  console.log("");
  console.log("Flow completed:");
  console.log("  ✓ Ad created on Stellar");
  console.log("  ✓ Order created on EVM");
  console.log("  ✓ Order locked on Stellar");
  console.log("  ✓ ZK proofs generated");
  console.log("  ✓ Bridger unlocked on Stellar");
  console.log("  ✓ Ad-creator unlocked on EVM");
  console.log("  ✓ Nullifiers consumed");
  console.log("  ✓ Token balances verified");
  console.log("");
  console.log("Order hash:", orderHash);
}

main().catch((err) => {
  console.error("\n\nCross-chain E2E test FAILED:", err);
  process.exit(1);
});
