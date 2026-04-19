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
      const actionable = data.filter((t) => !inflight.has(t.id));
      if (actionable.length > 0) {
        log.info("found actionable trades", { count: actionable.length });
      }
      for (const trade of actionable) {
        const kind = trade.adToken.chainKind;
        if (gates[kind].busy) continue;
        inflight.add(trade.id);
        gates[kind].busy = true;
        void handleTrade(trade, { api, cfg, evmWallet, stellarKeypair })
          .catch((err) => {
            const msg = err instanceof Error ? err.message : String(err);
            log.error("trade handler failed", {
              tradeId: trade.id,
              chain: kind,
              error: msg,
            });
          })
          .finally(() => {
            gates[kind].busy = false;
            inflight.delete(trade.id);
          });
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
    chain: trade.adToken.chainKind,
    symbol: trade.adToken.symbol,
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
  await confirmTrade(deps.api, trade.id, { txHash, signature: lock.signature });
  log.info("trade locked ✓", { ...ctx, txHash });
}
