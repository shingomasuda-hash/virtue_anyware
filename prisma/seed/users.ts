import { hashPassword } from 'better-auth/crypto';
import { prisma } from './client.js';
import { resolveDemoPassword } from './guard.js';
import type { UserRole } from '../../src/generated/prisma/index.js';

/**
 * 検証用アカウントのパスワード。
 *
 * 既定値は開発・テスト環境でのみ使われ、それ以外ではランダム生成される。
 * `SEED_DEMO_PASSWORD` で明示的に上書きできる（prisma/seed/guard.ts 参照）。
 */
const resolved = resolveDemoPassword();
export const DEMO_PASSWORD = resolved.password;
export const DEMO_PASSWORD_GENERATED = resolved.generated;

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
