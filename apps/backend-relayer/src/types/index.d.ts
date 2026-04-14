import { Prisma, ChainKind } from '@prisma/client';

export type HealthStatus = 'ok' | 'degraded' | 'error';
export interface HealthResponse {
  status: HealthStatus;
  uptimeSec: number;
  timestamp: string;
  checks: {
    liveness: 'ok';
    db: 'ok' | 'error';
  };
}

type PublicChain = {
  name: string;
  chainId: string;
  kind: ChainKind;
  adManagerAddress: string;
  orderPortalAddress: string;
  createdAt: string;
  updatedAt: string;
};

type TokenRow = {
  id: string;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  kind: string;
  assetIssuer: string | null;
  createdAt: Date;
  updatedAt: Date;
  chain: { id: string; name: string; chainId: bigint; kind: ChainKind };
};

type RouteTokenEmbed = {
  id: string;
  symbol: string;
  name: string;
  address: string;
  decimals: number;
  kind: string;
  assetIssuer: string | null;
  chain: { id: string; name: string; chainId: bigint; kind: ChainKind };
};

type RouteRow = {
  id: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  adToken: RouteTokenEmbed;
  orderToken: RouteTokenEmbed;
};
