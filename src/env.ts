import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must be at least 32 characters'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** 起動時に環境変数を検証する。秘密情報はコミットせず環境変数で供給する。 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new Error(`環境変数の設定が不正です: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}
