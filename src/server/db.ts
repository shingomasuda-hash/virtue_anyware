import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma';

/**
 * Prisma 7 はドライバアダプタ経由で接続する。
 * Neon へ移行する場合は `@prisma/adapter-neon` に差し替えるだけでよい。
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL が設定されていません。');
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
