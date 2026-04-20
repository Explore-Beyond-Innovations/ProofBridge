import { Keypair } from "@stellar/stellar-sdk";
import { JsonRpcProvider, Wallet } from "ethers";
import { ApiClient, type ApiError } from "./api/client.js";
import { linkStellar, loginEvm } from "./api/auth.js";
import {
  confirmTrade,
  listTrades,
  lockTrade,
  type Trade,
} from "./api/trades.js";
import {
  evmAddressNormalised,
  stellarAddressToHex32,
} from "./chain/address.js";
import { evmLockForOrder } from "./chain/evm.js";
import { stellarLockForOrder } from "./chain/stellar.js";
import { loadConfig, type Config } from "./config.js";
import { log } from "./logger.js";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isAlreadyLinked(err: unknown): boolean {
  const e = err as ApiError | Error;
  if ("status" in e && (e as ApiError).status === 409) return true;
  return /already.*linked|exists/i.test(
    e instanceof Error ? e.message : String(e),
  );
}

// Thrown when on-chain lock succeeded but /confirm didn't — the caller
// needs this signal so the trade stays quarantined out of the actionable
// set (see run loop).
class PostLockConfirmError extends Error {
  constructor(
    readonly txHash: string,
    readonly cause: unknown,
  ) {
    super(
      `confirmTrade failed after successful on-chain lock (txHash=${txHash}): ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
    this.name = "PostLockConfirmError";
  }
}

async function confirmWithRetry(
  api: ApiClient,
  tradeId: string,
  body: { txHash: string; signature: string },
  ctx: Record<string, unknown>,
): Promise<void> {
  const delays = [2_000, 4_000, 8_000, 16_000, 30_000];
  let last: unknown;
  for (let i = 0; i <= delays.length; i++) {
    try {
      await confirmTrade(api, tradeId, body);
      return;
    } catch (err) {
      last = err;
      if (i === delays.length) break;
      log.warn("confirmTrade retry", {
        ...ctx,
        attempt: i + 1,
        error: err instanceof Error ? err.message : String(err),
      });
      await sleep(delays[i]);
    }
  }
  throw new PostLockConfirmError(body.txHash, last);
}

interface ChainGate {
  busy: boolean;
}

export async function run(): Promise<void> {
  const cfg = loadConfig();
  log.info("booting auto-merchant-bot", {
    backend: cfg.BACKEND_URL,
    dryRun: cfg.DRY_RUN,
    pollMs: cfg.POLL_INTERVAL_MS,
  });

  const provider = new JsonRpcProvider(cfg.EVM_RPC_URL);
  const evmWallet = new Wallet(cfg.EVM_ADMIN_PRIVATE_KEY, provider);
  const stellarKeypair = Keypair.fromSecret(cfg.STELLAR_ADMIN_SECRET);
  const net = await provider.getNetwork();
  const evmChainId = Number(net.chainId);

  const api = new ApiClient(cfg.BACKEND_URL);

  // SIWE login + SEP-10 link. Registered as the reauth handler so a 401
  // mid-poll (after JWT expiry + failed refresh) transparently rebuilds
  // the session and retries the original request.
  const authenticate = async (): Promise<void> => {
    log.info("authenticating (EVM login)", {
      address: evmWallet.address,
      chainId: evmChainId,
    });
    const login = await loginEvm(api, evmWallet, evmChainId, {
      domain: cfg.SIGN_DOMAIN,
      uri: cfg.SIGN_URI,
    });
    log.info("EVM login ok", { userId: login.user.id });

    log.info("linking stellar wallet", {
      address: stellarKeypair.publicKey(),
    });
    try {
      await linkStellar(api, stellarKeypair);
      log.info("stellar link ok");
    } catch (err) {
      if (isAlreadyLinked(err)) {
        log.info("stellar wallet already linked — continuing");
      } else {
        throw err;
      }
    }
  };

  await authenticate();
  api.setReauth(authenticate);

  const ownAddresses = [
    evmAddressNormalised(evmWallet.address),
    stellarAddressToHex32(stellarKeypair.publicKey()),
  ];
  log.info("poll filter", { adCreatorAddress: ownAddresses });

  const gates: Record<"EVM" | "STELLAR", ChainGate> = {
    EVM: { busy: false },
    STELLAR: { busy: false },
  };
  const inflight = new Set<string>();

  while (true) {
    try {
      const { data } = await listTrades(api, {
        adCreatorAddress: ownAddresses,
        status: "ACTIVE",
        limit: 50,
      });
      if (data.length > 0) {
        log.info("poll result", {
          count: data.length,
          trades: data.map((t) => ({
            id: t.id,
            status: t.status,
            adCreator: t.adCreatorAddress,
            adChainKind: t.route.adToken.chain.kind,
            adChainId: t.route.adToken.chain.chainId,
            adSymbol: t.route.adToken.symbol,
          })),
        });
      }
      const actionable = data.filter((t) => !inflight.has(t.id));
      if (actionable.length > 0) {
        log.info("found actionable trades", { count: actionable.length });
      }
      for (const trade of actionable) {
        const kind = trade.route.adToken.chain.kind;
        if (gates[kind].busy) continue;
        inflight.add(trade.id);
        gates[kind].busy = true;
        void (async () => {
          try {
            await handleTrade(trade, { api, cfg, evmWallet, stellarKeypair });
            // Success: drop from inflight; the trade is now LOCKED server-
            // side so subsequent list queries won't return it anyway.
            inflight.delete(trade.id);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log.error("trade handler failed", {
              tradeId: trade.id,
              chain: kind,
              error: msg,
            });
            if (err instanceof PostLockConfirmError) {
              // On-chain lock already landed but /confirm could not stick.
              // Keep the trade in `inflight` so the next tick skips it —
              // otherwise we'd re-lock a trade the contract already
              // accepted. Recovery requires operator action (restart +
              // manual /confirm).
              log.error("trade QUARANTINED in memory to prevent double-lock", {
                tradeId: trade.id,
                txHash: err.txHash,
              });
            } else {
              inflight.delete(trade.id);
            }
          } finally {
            gates[kind].busy = false;
          }
        })();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("poll tick failed", { error: msg });
    }
    await sleep(cfg.POLL_INTERVAL_MS);
  }
}

async function handleTrade(
  trade: Trade,
  deps: {
    api: ApiClient;
    cfg: Config;
    evmWallet: Wallet;
    stellarKeypair: Keypair;
  },
): Promise<void> {
  const ctx = {
    tradeId: trade.id,
    adId: trade.adId,
    chain: trade.route.adToken.chain.kind,
    symbol: trade.route.adToken.symbol,
  };

  if (deps.cfg.DRY_RUN) {
    log.info("DRY_RUN: would lock trade", ctx);
    return;
  }

  log.info("requesting lock quote", ctx);
  const lock = await lockTrade(deps.api, trade.id);

  log.info("submitting on-chain lockForOrder", ctx);
  let txHash: string;
  if (lock.chainKind === "EVM") {
    txHash = await evmLockForOrder(
      {
        rpcUrl: deps.cfg.EVM_RPC_URL,
        privateKey: deps.cfg.EVM_ADMIN_PRIVATE_KEY,
      },
      lock,
    );
  } else {
    txHash = await stellarLockForOrder(
      {
        rpcUrl: deps.cfg.STELLAR_RPC_URL,
        networkPassphrase: deps.cfg.STELLAR_NETWORK_PASSPHRASE,
        keypair: deps.stellarKeypair,
      },
      lock,
    );
  }

  log.info("confirming on-chain lock", { ...ctx, txHash });
  await confirmWithRetry(
    deps.api,
    trade.id,
    { txHash, signature: lock.signature },
    ctx,
  );
  log.info("trade locked ✓", { ...ctx, txHash });
}
