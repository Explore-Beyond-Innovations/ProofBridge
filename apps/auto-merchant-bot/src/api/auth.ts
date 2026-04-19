import { Wallet } from "ethers"
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk"
import { SiweMessage } from "siwe"
import type { ApiClient } from "./client.js"

type ChainKind = "EVM" | "STELLAR"

interface ChallengeEvm {
  chainKind: "EVM"
  address: string
  nonce: string
  domain: string
  uri: string
  expiresAt: string
}

interface ChallengeStellar {
  chainKind: "STELLAR"
  address: string
  transaction: string
  networkPassphrase: string
  expiresAt: string
}

type Challenge = ChallengeEvm | ChallengeStellar

interface LoginResponse {
  user: { id: string; username: string }
  tokens: { access: string; refresh: string }
}

interface LinkWalletResponse {
  id: string
  address: string
  chainKind: ChainKind
  createdAt: string
}

async function challenge(
  api: ApiClient,
  input: { chainKind: ChainKind; address: string },
): Promise<Challenge> {
  return api.request<Challenge>("POST", "v1/auth/challenge", {
    body: input,
    auth: false,
  })
}

async function signEvm(
  api: ApiClient,
  wallet: Wallet,
  chainId: number,
  overrides?: { domain?: string; uri?: string },
): Promise<{ message: string; signature: string }> {
  const c = (await challenge(api, {
    chainKind: "EVM",
    address: wallet.address,
  })) as ChallengeEvm
  const message = new SiweMessage({
    domain: overrides?.domain ?? c.domain,
    address: wallet.address,
    statement: "Sign in with Ethereum to ProofBridge.",
    uri: overrides?.uri ?? c.uri,
    version: "1",
    chainId,
    nonce: c.nonce,
  }).prepareMessage()
  const signature = await wallet.signMessage(message)
  return { message, signature }
}

async function signStellar(
  api: ApiClient,
  keypair: Keypair,
): Promise<{ transaction: string }> {
  const c = (await challenge(api, {
    chainKind: "STELLAR",
    address: keypair.publicKey(),
  })) as ChallengeStellar
  const tx = TransactionBuilder.fromXDR(c.transaction, c.networkPassphrase)
  tx.sign(keypair)
  return { transaction: tx.toXDR() }
}

export async function loginEvm(
  api: ApiClient,
  wallet: Wallet,
  chainId: number,
  overrides?: { domain?: string; uri?: string },
): Promise<LoginResponse> {
  const { message, signature } = await signEvm(api, wallet, chainId, overrides)
  const res = await api.request<LoginResponse>("POST", "v1/auth/login", {
    body: { chainKind: "EVM", message, signature },
    auth: false,
  })
  api.setTokens(res.tokens)
  return res
}

export async function loginStellar(
  api: ApiClient,
  keypair: Keypair,
): Promise<LoginResponse> {
  const { transaction } = await signStellar(api, keypair)
  const res = await api.request<LoginResponse>("POST", "v1/auth/login", {
    body: { chainKind: "STELLAR", transaction },
    auth: false,
  })
  api.setTokens(res.tokens)
  return res
}

export async function linkEvm(
  api: ApiClient,
  wallet: Wallet,
  chainId: number,
  overrides?: { domain?: string; uri?: string },
): Promise<LinkWalletResponse> {
  const { message, signature } = await signEvm(api, wallet, chainId, overrides)
  return api.post<LinkWalletResponse>("v1/auth/link", {
    chainKind: "EVM",
    message,
    signature,
  })
}

export async function linkStellar(
  api: ApiClient,
  keypair: Keypair,
): Promise<LinkWalletResponse> {
  const { transaction } = await signStellar(api, keypair)
  return api.post<LinkWalletResponse>("v1/auth/link", {
    chainKind: "STELLAR",
    transaction,
  })
}
