import { PrismaClient } from '@prisma/client';
import { seedAdmin } from './utils';

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
