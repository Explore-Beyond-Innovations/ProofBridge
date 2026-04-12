import { PrismaClient } from "@prisma/client";
import { hash as argon2hash } from "@node-rs/argon2";
import { ethers } from "ethers";

// `null` means the role wasn't deployed for this chain in the current flow;
// the Prisma columns are non-null so we substitute a recognizable sentinel at
// the DB boundary (see `sentinelFor`) and log a warning.
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
    tokenAddress: string;
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
        decimals: 18,
        kind: "ERC20",
      },
      update: {
        symbol: deployed.eth.tokenSymbol,
        name: deployed.eth.tokenName,
        decimals: 18,
        kind: "ERC20",
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
          decimals: 7,
          kind: "NATIVE",
        },
        update: {
          symbol: s.tokenSymbol,
          name: s.tokenName,
          decimals: 7,
          kind: "NATIVE",
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
    }

    console.log("[seed] done");
  } finally {
    await prisma.$disconnect();
  }
}

export function randomAddress(): string {
  return ethers.Wallet.createRandom().address;
}
