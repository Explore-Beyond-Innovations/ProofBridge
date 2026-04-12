import { PrismaClient } from "@prisma/client";
import { hash as argon2hash } from "@node-rs/argon2";
import { ethers } from "ethers";

export interface DeployedContracts {
  eth: {
    name: string;
    chainId: string;
    adManagerAddress: string;
    orderPortalAddress: string;
    merkleManagerAddress: string;
    verifierAddress: string;
    tokenName: string;
    tokenSymbol: string;
    tokenAddress: string;
  };
  stellar?: {
    name: string;
    chainId: string;
    adManagerAddress: string; // 0x + 64 hex
    orderPortalAddress: string;
    merkleManagerAddress: string;
    verifierAddress: string;
    tokenName: string;
    tokenSymbol: string;
    tokenAddress: string;
    adminSecret: string;
  };
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
    const ethChain = await prisma.chain.upsert({
      where: { chainId: BigInt(deployed.eth.chainId) },
      create: {
        name: deployed.eth.name,
        chainId: BigInt(deployed.eth.chainId),
        kind: "EVM",
        adManagerAddress: deployed.eth.adManagerAddress,
        orderPortalAddress: deployed.eth.orderPortalAddress,
        mmr: { create: { chainId: deployed.eth.chainId } },
      },
      update: {
        name: deployed.eth.name,
        adManagerAddress: deployed.eth.adManagerAddress,
        orderPortalAddress: deployed.eth.orderPortalAddress,
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
      const stellarChain = await prisma.chain.upsert({
        where: { chainId: BigInt(s.chainId) },
        create: {
          name: s.name,
          chainId: BigInt(s.chainId),
          kind: "STELLAR",
          adManagerAddress: s.adManagerAddress,
          orderPortalAddress: s.orderPortalAddress,
          mmr: { create: { chainId: s.chainId } },
        },
        update: {
          name: s.name,
          adManagerAddress: s.adManagerAddress,
          orderPortalAddress: s.orderPortalAddress,
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
