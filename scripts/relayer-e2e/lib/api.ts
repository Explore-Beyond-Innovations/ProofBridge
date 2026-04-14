// HTTP client against the running backend-relayer. Mirrors the surface of
// apps/backend-relayer/test/integrations/api.ts but uses fetch instead of
// supertest so we can drive a containerized relayer over the network.

const RELAYER_URL = process.env.RELAYER_URL ?? "http://localhost:2005";

export interface ApiResponse<T = any> {
  status: number;
  ok: boolean;
  body: T;
}

async function request<T = any>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  opts: { body?: unknown; token?: string } = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${RELAYER_URL}${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  let body: any = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { status: res.status, ok: res.ok, body };
}

function expectStatus<T>(res: ApiResponse<T>, expected: number, label: string): ApiResponse<T> {
  if (res.status !== expected) {
    throw new Error(
      `[${label}] expected status ${expected}, got ${res.status}: ${JSON.stringify(res.body)}`
    );
  }
  return res;
}

// ── auth ──────────────────────────────────────────────────────────────

export const apiAuthChallenge = (body: { address: string; chainKind: "EVM" | "STELLAR" }) =>
  request("POST", "/v1/auth/challenge", { body });

export const apiAuthLogin = (body: Record<string, unknown>) =>
  request("POST", "/v1/auth/login", { body });

// ── routes ────────────────────────────────────────────────────────────

export const getRoutes = (adChainId: string, orderChainId: string) =>
  request(
    "GET",
    `/v1/routes?adChainId=${adChainId}&orderChainId=${orderChainId}`,
  );

// ── ads ───────────────────────────────────────────────────────────────

export const apiCreateAd = (
  token: string,
  routeId: string,
  creatorDstAddress: string,
  fundAmount: string
) =>
  request("POST", "/v1/ads/create", {
    token,
    body: { routeId, creatorDstAddress, fundAmount },
  });

export const apiConfirm = (adId: string, token: string, txHash: `0x${string}`) =>
  request("POST", `/v1/ads/${adId}/confirm`, { token, body: { txHash } });

export const apiFundAd = (adId: string, token: string, amount: string) =>
  request("POST", `/v1/ads/${adId}/fund`, {
    token,
    body: { poolAmountTopUp: amount },
  });

export const apiWithdraw = (
  adId: string,
  token: string,
  amount: string,
  to: string
) =>
  request("POST", `/v1/ads/${adId}/withdraw`, {
    token,
    body: { poolAmountWithdraw: amount, to },
  });

export const apiGetAd = (adId: string) => request("GET", `/v1/ads/${adId}`);

export const apiCloseAd = (adId: string, token: string, body: { to: string }) =>
  request("POST", `/v1/ads/${adId}/close`, { token, body });

// ── trades ────────────────────────────────────────────────────────────

export const apiCreateOrder = (
  token: string,
  body: {
    adId: string;
    routeId: string;
    amount: string;
    bridgerDstAddress: string;
  }
) => request("POST", "/v1/trades/create", { token, body });

export const apiGetTrade = (tradeId: string) => request("GET", `/v1/trades/${tradeId}`);

export const apiTradeConfirm = (tradeId: string, token: string, txHash: `0x${string}`) =>
  request("POST", `/v1/trades/${tradeId}/confirm`, { token, body: { txHash } });

export const apiLockOrder = (token: string, tradeId: string) =>
  request("POST", `/v1/trades/${tradeId}/lock`, { token });

export const apiTradeParams = (token: string, tradeId: string) =>
  request("GET", `/v1/trades/${tradeId}/params`, { token });

export const apiUnlockOrder = (token: string, tradeId: string, signature: string) =>
  request("POST", `/v1/trades/${tradeId}/unlock`, {
    token,
    body: { signature },
  });

export const apiTradeUnlockConfirm = (
  token: string,
  tradeId: string,
  txHash: `0x${string}`
) =>
  request("POST", `/v1/trades/${tradeId}/unlock/confirm`, {
    token,
    body: { txHash },
  });

export { expectStatus, RELAYER_URL };
