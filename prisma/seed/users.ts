import { hashPassword } from 'better-auth/crypto';
import { prisma } from './client.js';
import type { UserRole } from '../../src/generated/prisma/index.js';

/** 開発・検証用の共通パスワード。本番環境では絶対に使用しないこと。 */
export const DEMO_PASSWORD = 'Virtue#2026';

export interface UserSeed {
  email: string;
  name: string;
  role: UserRole;
  agencyId?: string | null;
}

/**
 * Better Auth の user / account を直接作成する。
 * パスワードは Better Auth と同じ scrypt ハッシュで保存するため、
 * 通常のログインフローでそのまま認証できる。
 */
export async function seedUser(organizationId: string, seed: UserSeed) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: seed.email },
    update: {
      name: seed.name,
      role: seed.role,
      organizationId,
      agencyId: seed.agencyId ?? null,
      isActive: true,
    },
    create: {
      email: seed.email,
      name: seed.name,
      emailVerified: true,
      role: seed.role,
      organizationId,
      agencyId: seed.agencyId ?? null,
      isActive: true,
    },
  });

  await prisma.account.upsert({
    where: { providerId_accountId: { providerId: 'credential', accountId: user.id } },
    update: { password: passwordHash },
    create: {
      userId: user.id,
      providerId: 'credential',
      accountId: user.id,
      password: passwordHash,
    },
  });

  return user;
}
