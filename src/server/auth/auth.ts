import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';
import { prisma } from '@/server/db';

/**
 * 認証基盤。
 * 2026-09 時点で Auth.js v5 は beta のみのため、安定版のある Better Auth 1.7 系を採用する
 * （docs/02_ARCHITECTURE.md 2.1 参照）。
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
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
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
