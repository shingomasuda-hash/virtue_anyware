import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI 設定。
 *
 * `prisma generate` は DB へ接続しないため DATABASE_URL を必要としない。
 * `env('DATABASE_URL')` を使うと未設定時に設定読み込み自体が失敗し、
 * Vercel のビルド（DATABASE_URL をランタイム専用にしている場合）が落ちるため、
 * URL が無いときは datasource を省略する。
 * migrate / db push は URL が必要な時点で Prisma 側が明示的にエラーを出す。
 */
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed/index.ts',
  },
});
