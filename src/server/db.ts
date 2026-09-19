import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma';

/**
 * Prisma 7 はドライバアダプタ経由で接続する。
 * Neon へ移行する場合は `@prisma/adapter-neon` に差し替えるだけでよい。
 */
function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL が設定されていません。Vercel では Project Settings → Environment Variables で設定してください。',
    );
  }
  // サーバーレス（Vercel）では 1 インスタンスあたりの同時接続を絞る。
  // 既定のプール（10）のままだと同時実行数ぶん接続が増え、
  // Neon / Supabase の接続上限を超えて落ちる。
  // 併せて、接続文字列は必ず**プーラー経由**（Neon なら -pooler）を指定すること。
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? (process.env.VERCEL ? 1 : 10)),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrismaClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

/**
 * PrismaClient のシングルトン。
 *
 * **遅延生成**にしている理由:
 * Next.js のビルド（page data の収集）はモジュールを読み込むだけで実行するため、
 * モジュール先頭で `new PrismaClient()` するとビルド時に DATABASE_URL を要求してしまう。
 * Vercel で DATABASE_URL をランタイム専用にしているとビルドが失敗する。
 * Proxy で初回アクセスまで生成を遅らせることで、ビルド時には接続を作らない。
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    const client = getPrismaClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
  has(_target, property) {
    return Reflect.has(getPrismaClient(), property);
  },
});
