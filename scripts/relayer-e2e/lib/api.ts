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

export const apiAuthRefresh = (refresh: string) =>
  request("POST", "/v1/auth/refresh", { body: { refresh } });

export const apiAuthLink = (token: string, body: Record<string, unknown>) =>
  request("POST", "/v1/auth/link", { token, body });

// ── routes ────────────────────────────────────────────────────────────

export interface RouteQuery {
  adTokenId?: string;
  orderTokenId?: string;
  adChainId?: string;
  orderChainId?: string;
  symbol?: string;
  cursor?: string;
  limit?: number;
}

export const getRoutes = (
  adChainIdOrQuery: string | RouteQuery,
  orderChainId?: string,
) => {
  const q: RouteQuery =
    typeof adChainIdOrQuery === "string"
      ? { adChainId: adChainIdOrQuery, orderChainId }
      : adChainIdOrQuery;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  const suffix = qs.toString();
  return request("GET", `/v1/routes${suffix ? `?${suffix}` : ""}`);
};

export const apiGetRoute = (routeId: string) =>
  request("GET", `/v1/routes/${routeId}`);

// ── ads ───────────────────────────────────────────────────────────────

export interface AdQuery {
  routeId?: string;
  creatorAddress?: string;
  creatorAddresses?: string[] | string;
  adChainId?: number | string;
  orderChainId?: number | string;
  adTokenId?: string;
  orderTokenId?: string;
  status?: "ACTIVE" | "PAUSED" | "EXHAUSTED" | "CLOSED";
  cursor?: string;
  limit?: number;
}

export const apiListAds = (query: AdQuery = {}) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    qs.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const suffix = qs.toString();
  return request("GET", `/v1/ads${suffix ? `?${suffix}` : ""}`);
};

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

export const apiUpdateAd = (
  adId: string,
  token: string,
  body: {
    status?: "ACTIVE" | "PAUSED";
    minAmount?: string;
    maxAmount?: string;
    metadata?: Record<string, unknown>;
  },
) => request("PATCH", `/v1/ads/${adId}/update`, { token, body });

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

export interface TradeQuery {
  routeId?: string;
  adId?: string;
  adCreatorAddress?: string;
  bridgerAddress?: string;
  participantAddresses?: string[] | string;
  adTokenId?: string;
  orderTokenId?: string;
  minAmount?: string;
  maxAmount?: string;
  cursor?: string;
  limit?: number;
}

export const apiListTrades = (query: TradeQuery = {}) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue;
    qs.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }
  const suffix = qs.toString();
  return request("GET", `/v1/trades/all${suffix ? `?${suffix}` : ""}`);
};

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
