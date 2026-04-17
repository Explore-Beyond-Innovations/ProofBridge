// HTTP login + link flows — EVM (SIWE) and Stellar (signed XDR).
import { SiweMessage } from "siwe";
import { privateKeyToAddress, signMessage } from "viem/accounts";
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk";
import {
  apiAuthChallenge,
  apiAuthLink,
  apiAuthLogin,
  expectStatus,
} from "./api.js";

type ChainKind = "EVM" | "STELLAR";

async function buildEvmPayload(privateKey: `0x${string}`) {
  const address = privateKeyToAddress(privateKey);
  const challenge = expectStatus(
    await apiAuthChallenge({ address, chainKind: "EVM" }),
    200,
    "auth.challenge(EVM)",
  );

  const now = new Date().toISOString();
  const exp = new Date(Date.now() + 5 * 60_000).toISOString();
  const msg = new SiweMessage({
    domain: challenge.body.domain,
    address,
    statement: "Sign in to ProofBridge",
    uri: challenge.body.uri,
    version: "1",
    chainId: 1,
    nonce: challenge.body.nonce,
    issuedAt: now,
    expirationTime: exp,
  });
  const message = msg.prepareMessage();
  const signature = await signMessage({ message, privateKey });
  return { chainKind: "EVM" as ChainKind, message, signature };
}

async function buildStellarPayload(keypair: Keypair) {
  const challenge = expectStatus(
    await apiAuthChallenge({
      address: keypair.publicKey(),
      chainKind: "STELLAR",
    }),
    200,
    "auth.challenge(STELLAR)",
  );

  const xdrString = challenge.body.transaction as string;
  const passphrase =
    (challenge.body.networkPassphrase as string) ||
    process.env.STELLAR_NETWORK_PASSPHRASE ||
    Networks.TESTNET;

  const tx = TransactionBuilder.fromXDR(xdrString, passphrase as Networks);
  tx.sign(keypair);
  const signedXdr = tx.toEnvelope().toXDR("base64");
  return { chainKind: "STELLAR" as ChainKind, transaction: signedXdr };
}

export async function loginEvm(privateKey: `0x${string}`): Promise<string> {
  const payload = await buildEvmPayload(privateKey);
  const login = expectStatus(
    await apiAuthLogin(payload),
    201,
    "auth.login(EVM)",
  );
  return login.body.tokens.access as string;
}

export async function loginStellar(keypair: Keypair): Promise<string> {
  const payload = await buildStellarPayload(keypair);
  const login = expectStatus(
    await apiAuthLogin(payload),
    201,
    "auth.login(STELLAR)",
  );
  return login.body.tokens.access as string;
}

export async function linkEvm(
  access: string,
  privateKey: `0x${string}`,
): Promise<void> {
  const payload = await buildEvmPayload(privateKey);
  expectStatus(await apiAuthLink(access, payload), 201, "auth.link(EVM)");
}

export async function linkStellar(
  access: string,
  keypair: Keypair,
): Promise<void> {
  const payload = await buildStellarPayload(keypair);
  expectStatus(await apiAuthLink(access, payload), 201, "auth.link(STELLAR)");
}
