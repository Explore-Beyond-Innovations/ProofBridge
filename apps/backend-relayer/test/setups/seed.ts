import { ChainKind, PrismaClient } from '@prisma/client';
import { ChainData, seedAdmin, seedChain, seedRoute, seedToken } from './utils';
import { StellarChainData } from './stellar-setup';

export const seedDB = async (
  ethContracts: ChainData,
  stellarContracts?: StellarChainData,
) => {
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();

    await seedAdmin(prisma, 'admin@x.com', 'ChangeMe123!');

    const ethChain = await seedChain(prisma, {
      name: ethContracts.name,
      chainId: BigInt(ethContracts.chainId),
      ad: ethContracts.adManagerAddress,
      op: ethContracts.orderPortalAddress,
      kind: ChainKind.EVM,
    });

    const ethToken = await seedToken(
      prisma,
      ethChain.id,
      ethContracts.tokenName,
      ethContracts.tokenSymbol,
      ethContracts.tokenAddress,
    );

    if (stellarContracts) {
      const stellarChain = await seedChain(prisma, {
        name: stellarContracts.name,
        chainId: BigInt(stellarContracts.chainId),
        ad: stellarContracts.adManagerAddress,
        // Stellar side has no OrderPortal in this direction — reuse the
        // AdManager address as a non-null placeholder for the schema.
        op: stellarContracts.adManagerAddress,
        kind: ChainKind.STELLAR,
      });

      const stellarToken = await seedToken(
        prisma,
        stellarChain.id,
        stellarContracts.tokenName,
        stellarContracts.tokenSymbol,
        stellarContracts.tokenAddress,
        'NATIVE',
        7,
      );

      // Stellar ad token → EVM order token.
      await seedRoute(prisma, stellarToken.id, ethToken.id);
    }

    await prisma.$disconnect();

    console.log('Seeding completed.');
  } catch (error) {
    console.error('Error seeding db:', error);
  } finally {
    await prisma.$disconnect();
  }
};

export const seedDBe2e = async () => {
  const prisma = new PrismaClient();
  try {
    await prisma.$connect();

    await seedAdmin(prisma, 'admin@x.com', 'ChangeMe123!');

    await prisma.$disconnect();

    console.log('Seeding completed.');
  } catch (error) {
    console.error('Error seeding db:', error);
  } finally {
    await prisma.$disconnect();
  }
};
