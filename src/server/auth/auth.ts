import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from '@/server/db';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/password';
import { resolveBaseUrl, resolveTrustedOrigins } from './base-url';

/**
 * 認証基盤。
 * 2026-09 時点で Auth.js v5 は beta のみのため、安定版のある Better Auth 1.7 系を採用する
 * （docs/02_ARCHITECTURE.md 2.1 参照）。
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: process.env.BETTER_AUTH_SECRET,
  // Vercel では BETTER_AUTH_URL 未設定でも VERCEL_URL から解決する（base-url.ts 参照）
  baseURL: resolveBaseUrl(),
  trustedOrigins: resolveTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    // 強度の基準は src/lib/password.ts に一本化する
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
    autoSignIn: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  advanced: {
    cookiePrefix: 'virtue',
    useSecureCookies: process.env.NODE_ENV === 'production',
    defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
  },
  // ブルートフォース対策（§31 レート制御）
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    customRules: {
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 300, max: 3 },
    },
  },
  user: {
    additionalFields: {
      role: { type: 'string', required: false, input: false, defaultValue: 'HQ_STAFF' },
      organizationId: { type: 'string', required: false, input: false },
      agencyId: { type: 'string', required: false, input: false },
      phone: { type: 'string', required: false, input: false },
      isActive: { type: 'boolean', required: false, input: false, defaultValue: true },
      lastLoginAt: { type: 'date', required: false, input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        /**
         * 無効化されたユーザーにはセッションを発行しない。
         *
         * これが無いと「ログインは成功するが画面に入れない」状態になり、
         * 利用者からはログイン画面へ戻され続けるだけに見える。
         * 無効化を即座に効かせる責務はここ（サーバー側）に置く。
         */
        async before(session, ctx) {
          if (!ctx) return;
          const user = await ctx.context.internalAdapter.findUserById(session.userId);
          if (user && (user as { isActive?: boolean }).isActive === false) {
            // 原因は明かさない（アカウント列挙対策 §31）。ログイン画面は汎用メッセージを表示する。
            throw APIError.from('FORBIDDEN', { message: 'この操作は許可されていません。', code: 'INACTIVE_USER' });
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
