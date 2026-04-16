import { PrismaClient, type TokenKind } from "@prisma/client";
import { hash as argon2hash } from "@node-rs/argon2";
import { ethers } from "ethers";

export interface DeployedTokenEth {
  pairKey: string;
  name: string;
  symbol: string;
  address: string;
  kind: TokenKind; // ERC20 | NATIVE
  decimals: number;
}

export interface DeployedTokenStellar {
  pairKey: string;
  name: string;
  symbol: string;
  address: string; // 0x + 64 hex
  contractId?: string; // strkey, for ops scripts
  kind: TokenKind; // NATIVE | SAC | SEP41
  decimals: number;
  assetIssuer?: string | null;
}

export interface DeployedContracts {
  eth: {
    name: string;
    chainId: string;
    adManagerAddress: string | null;
    orderPortalAddress: string | null;
    merkleManagerAddress: string;
    verifierAddress: string;
    /** Address of the EVM wNativeToken (infrastructure, not a tradeable token). */
    wNativeTokenAddress?: string;
    tokens: DeployedTokenEth[];
  };
  stellar?: {
    name: string;
    chainId: string;
    adManagerAddress: string | null;
    orderPortalAddress: string | null;
    merkleManagerAddress: string;
    verifierAddress: string;
    /** 0x + 64 hex of the native XLM SAC. */
    wNativeTokenAddress?: string;
    tokens: DeployedTokenStellar[];
  };
}

function sentinelFor(role: string, chain: string, width: 40 | 64): string {
  console.warn(
    `[seed] ${chain} has no ${role} deployed — writing zero-address sentinel.`,
  );
  return "0x" + "0".repeat(width);
}

export async function seedDb(deployed: DeployedContracts): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();

    // Admin.
    const passwordHash = await argon2hash("ChangeMe123!");
    await prisma.admin.upsert({
      where: { email: "admin@x.com" },
      create: { email: "admin@x.com", passwordHash },
      update: { passwordHash },
    });

    // EVM chain + tokens.
    const ethAdManager =
      deployed.eth.adManagerAddress ?? sentinelFor("adManager", "eth", 40);
    const ethOrderPortal =
      deployed.eth.orderPortalAddress ?? sentinelFor("orderPortal", "eth", 40);
    const ethChain = await prisma.chain.upsert({
      where: { chainId: BigInt(deployed.eth.chainId) },
      create: {
        name: deployed.eth.name,
        chainId: BigInt(deployed.eth.chainId),
        kind: "EVM",
        adManagerAddress: ethAdManager,
        orderPortalAddress: ethOrderPortal,
        mmr: { create: { chainId: deployed.eth.chainId } },
      },
      update: {
        name: deployed.eth.name,
        adManagerAddress: ethAdManager,
        orderPortalAddress: ethOrderPortal,
      },
      select: { id: true },
    });

    const ethTokenIds = new Map<string, string>(); // pairKey → token.id
    for (const tok of deployed.eth.tokens) {
      const row = await prisma.token.upsert({
        where: {
          chainUid_address: { chainUid: ethChain.id, address: tok.address },
        },
        create: {
          chainUid: ethChain.id,
          symbol: tok.symbol,
          name: tok.name,
          address: tok.address,
          decimals: tok.decimals,
          kind: tok.kind,
        },
        update: {
          symbol: tok.symbol,
          name: tok.name,
          decimals: tok.decimals,
          kind: tok.kind,
        },
        select: { id: true },
      });
      ethTokenIds.set(tok.pairKey, row.id);
    }

    // Stellar chain + tokens (optional).
    if (deployed.stellar) {
      const s = deployed.stellar;
      const stellarAdManager =
        s.adManagerAddress ?? sentinelFor("adManager", "stellar", 64);
      const stellarOrderPortal =
        s.orderPortalAddress ?? sentinelFor("orderPortal", "stellar", 64);
      const stellarChain = await prisma.chain.upsert({
        where: { chainId: BigInt(s.chainId) },
        create: {
          name: s.name,
          chainId: BigInt(s.chainId),
          kind: "STELLAR",
          adManagerAddress: stellarAdManager,
          orderPortalAddress: stellarOrderPortal,
          mmr: { create: { chainId: s.chainId } },
        },
        update: {
          name: s.name,
          adManagerAddress: stellarAdManager,
          orderPortalAddress: stellarOrderPortal,
        },
        select: { id: true },
      });

      const stellarTokenIds = new Map<string, string>();
      for (const tok of s.tokens) {
        const assetIssuer = tok.kind === "SAC" ? (tok.assetIssuer ?? null) : null;
        if (tok.kind === "SAC" && !assetIssuer) {
          throw new Error(
            `[seed] stellar token ${tok.symbol} is SAC but assetIssuer is missing`,
          );
        }
        const row = await prisma.token.upsert({
          where: {
            chainUid_address: {
              chainUid: stellarChain.id,
              address: tok.address,
            },
          },
          create: {
            chainUid: stellarChain.id,
            symbol: tok.symbol,
            name: tok.name,
            address: tok.address,
            decimals: tok.decimals,
            kind: tok.kind,
            assetIssuer,
          },
          update: {
            symbol: tok.symbol,
            name: tok.name,
            decimals: tok.decimals,
            kind: tok.kind,
            assetIssuer,
          },
          select: { id: true },
        });
        stellarTokenIds.set(tok.pairKey, row.id);
      }

      // Routes — one per pairKey per direction.
      // Both chains host both roles, so each pair becomes two Route rows:
      //   (order on eth, ad on stellar) and (order on stellar, ad on eth).
      for (const tok of deployed.eth.tokens) {
        const ethId = ethTokenIds.get(tok.pairKey);
        const stellarId = stellarTokenIds.get(tok.pairKey);
        if (!ethId || !stellarId) {
          throw new Error(
            `[seed] missing counterpart for pairKey=${tok.pairKey} (eth=${!!ethId}, stellar=${!!stellarId})`,
          );
        }
        await prisma.route.upsert({
          where: {
            orderTokenId_adTokenId: {
              orderTokenId: ethId,
              adTokenId: stellarId,
            },
          },
          create: { adTokenId: stellarId, orderTokenId: ethId },
          update: {},
        });
        await prisma.route.upsert({
          where: {
            orderTokenId_adTokenId: {
              orderTokenId: stellarId,
              adTokenId: ethId,
            },
          },
          create: { adTokenId: ethId, orderTokenId: stellarId },
          update: {},
        });
      }
    }

    console.log("[seed] done");
  } finally {
    await prisma.$disconnect();
  }
}

export function randomAddress(): string {
  return ethers.Wallet.createRandom().address;
}
