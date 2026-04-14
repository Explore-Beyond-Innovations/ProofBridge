import { PrismaClient, type TokenKind } from "@prisma/client";
import { hash as argon2hash } from "@node-rs/argon2";
import { ethers } from "ethers";

export interface DeployedContracts {
  eth: {
    name: string;
    chainId: string;
    adManagerAddress: string | null;
    orderPortalAddress: string | null;
    merkleManagerAddress: string;
    verifierAddress: string;
    tokenName: string;
    tokenSymbol: string;
    tokenAddress: string;
    tokenKind?: TokenKind; // defaults to ERC20
    tokenDecimals?: number; // defaults to 18
  };
  stellar?: {
    name: string;
    chainId: string;
    adManagerAddress: string | null; // 0x + 64 hex
    orderPortalAddress: string | null;
    merkleManagerAddress: string;
    verifierAddress: string;
    tokenName: string;
    tokenSymbol: string;
    tokenAddress: string; // 0x + 64 hex of the SAC contract id
    tokenKind?: TokenKind; // defaults to NATIVE
    tokenDecimals?: number; // defaults to 7
    tokenAssetIssuer?: string | null;
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

    // EVM chain + token.
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

    const ethTokenKind: TokenKind = deployed.eth.tokenKind ?? "ERC20";
    const ethTokenDecimals = deployed.eth.tokenDecimals ?? 18;
    const ethToken = await prisma.token.upsert({
      where: {
        chainUid_address: {
          chainUid: ethChain.id,
          address: deployed.eth.tokenAddress,
        },
      },
      create: {
        chainUid: ethChain.id,
        symbol: deployed.eth.tokenSymbol,
        name: deployed.eth.tokenName,
        address: deployed.eth.tokenAddress,
        decimals: ethTokenDecimals,
        kind: ethTokenKind,
      },
      update: {
        symbol: deployed.eth.tokenSymbol,
        name: deployed.eth.tokenName,
        decimals: ethTokenDecimals,
        kind: ethTokenKind,
      },
      select: { id: true },
    });

    // Stellar chain + token (optional).
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

      const stellarTokenKind: TokenKind = s.tokenKind ?? "NATIVE";
      const stellarTokenDecimals = s.tokenDecimals ?? 7;
      const stellarAssetIssuer =
        stellarTokenKind === "SAC" ? (s.tokenAssetIssuer ?? null) : null;
      if (stellarTokenKind === "SAC" && !stellarAssetIssuer) {
        throw new Error(
          `[seed] stellar token ${s.tokenSymbol} is SAC but tokenAssetIssuer is missing`,
        );
      }
      const stellarToken = await prisma.token.upsert({
        where: {
          chainUid_address: {
            chainUid: stellarChain.id,
            address: s.tokenAddress,
          },
        },
        create: {
          chainUid: stellarChain.id,
          symbol: s.tokenSymbol,
          name: s.tokenName,
          address: s.tokenAddress,
          decimals: stellarTokenDecimals,
          kind: stellarTokenKind,
          assetIssuer: stellarAssetIssuer,
        },
        update: {
          symbol: s.tokenSymbol,
          name: s.tokenName,
          decimals: stellarTokenDecimals,
          kind: stellarTokenKind,
          assetIssuer: stellarAssetIssuer,
        },
        select: { id: true },
      });
      await prisma.route.upsert({
        where: {
          orderTokenId_adTokenId: {
            orderTokenId: ethToken.id,
            adTokenId: stellarToken.id,
          },
        },
        create: {
          adTokenId: stellarToken.id,
          orderTokenId: ethToken.id,
        },
        update: {},
      });
      // Both chains host both roles — seed the reverse route too so orders
      // originating on Stellar can settle against ads on EVM.
      await prisma.route.upsert({
        where: {
          orderTokenId_adTokenId: {
            orderTokenId: stellarToken.id,
            adTokenId: ethToken.id,
          },
        },
        create: {
          adTokenId: ethToken.id,
          orderTokenId: stellarToken.id,
        },
        update: {},
      });
    }

    console.log("[seed] done");
  } finally {
    await prisma.$disconnect();
  }
}

export function randomAddress(): string {
  return ethers.Wallet.createRandom().address;
}
