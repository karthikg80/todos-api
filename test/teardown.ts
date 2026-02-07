import { prisma } from '../src/prismaClient';

/**
 * Jest global teardown - runs once after all tests.
 * Disconnects Prisma client to prevent hanging connections.
 */
export default async function globalTeardown() {
  console.log('\n🧹 Cleaning up test environment...\n');

  try {
    await prisma.$disconnect();
    console.log('✅ Prisma client disconnected\n');
  } catch (error) {
    console.error('⚠️  Error disconnecting Prisma:', error);
  }
}
