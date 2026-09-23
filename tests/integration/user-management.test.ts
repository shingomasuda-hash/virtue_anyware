import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { can } from '@/server/authz/context';
import { DomainError } from '@/lib/errors';
import {
  assignableRoles,
  createUser,
  findUserById,
  listUsers,
  resetUserPassword,
  updateUser,
} from '@/server/services/users';

/**
 * ユーザー管理の統合テスト。
 * 権限昇格・自分自身の締め出し・組織をまたぐ参照が
 * サーバー側で実際に止まることを DB を使って検証する。
 */

const ids = {
  org: 'um-org',
  otherOrg: 'um-org-other',
  agency: 'um-agency',
  otherAgency: 'um-agency-other',
  superAdmin: 'um-user-super',
  hqAdmin: 'um-user-hqadmin',
  otherOrgUser: 'um-user-other-org',
};

const PASSWORD = 'Str0ng!Passw0rd#2026';

function ctxOf(role: AccessContext['role'], userId: string, agencyId: string | null = null): AccessContext {
  return { userId, role, organizationId: ids.org, agencyId, email: `${userId}@example.jp`, name: userId };
}

const superAdmin = ctxOf('SUPER_ADMIN', ids.superAdmin);
const hqAdmin = ctxOf('HQ_ADMIN', ids.hqAdmin);

/** テスト毎に衝突しないメールアドレスを作る。 */
let seq = 0;
const emailOf = (label: string) => `um-${label}-${++seq}@example.jp`;

/** 前回実行の残骸を消す。テスト DB を使い回しても結果が変わらないようにする。 */
async function cleanUp(): Promise<void> {
  const stale = await prisma.user.findMany({
    where: { email: { startsWith: 'um-' } },
    select: { id: true },
  });
  const userIds = stale.map((u) => u.id);
  if (userIds.length === 0) return;
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

beforeAll(async () => {
  execSync('npx prisma migrate deploy', { cwd: process.cwd(), stdio: 'ignore' });
  await cleanUp();

  for (const [id, code, name] of [
    [ids.org, 'UMORG', 'ユーザー管理テスト組織'],
    [ids.otherOrg, 'UMORG2', '別組織'],
  ] as const) {
    await prisma.organization.upsert({ where: { id }, update: {}, create: { id, code, name } });
  }
  for (const [id, organizationId, code, name] of [
    [ids.agency, ids.org, 'UM-A', 'テスト代理店'],
    [ids.otherAgency, ids.otherOrg, 'UM-B', '別組織の代理店'],
  ] as const) {
    await prisma.agency.upsert({ where: { id }, update: {}, create: { id, organizationId, code, name } });
  }

  // 組織にはあらかじめ 2 名の管理者を置く（「最後の管理者」判定を単体で試すため）
  for (const [id, role, organizationId] of [
    [ids.superAdmin, 'SUPER_ADMIN', ids.org],
    [ids.hqAdmin, 'HQ_ADMIN', ids.org],
    [ids.otherOrgUser, 'HQ_ADMIN', ids.otherOrg],
  ] as const) {
    await prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email: `${id}@example.jp`,
        name: id,
        emailVerified: true,
        role,
        organizationId,
        isActive: true,
      },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('権限（§4 / docs/04_RBAC.md）', () => {
  it('代理店ロールは user:manage を持たない', () => {
    expect(can(ctxOf('AGENCY_ADMIN', 'x', ids.agency), 'user:manage')).toBe(false);
    expect(can(ctxOf('AGENCY_STAFF', 'x', ids.agency), 'user:manage')).toBe(false);
    expect(can(ctxOf('HQ_STAFF', 'x'), 'user:manage')).toBe(false);
    expect(can(hqAdmin, 'user:manage')).toBe(true);
  });

  it('SUPER_ADMIN を選択肢に出せるのは SUPER_ADMIN のみ', () => {
    expect(assignableRoles(hqAdmin)).not.toContain('SUPER_ADMIN');
    expect(assignableRoles(superAdmin)).toContain('SUPER_ADMIN');
  });
});

describe('ユーザー作成', () => {
  it('本部管理者は SUPER_ADMIN を作成できない（権限昇格の防止）', async () => {
    await expect(
      createUser(hqAdmin, { email: emailOf('escalate'), name: '昇格', role: 'SUPER_ADMIN', password: PASSWORD }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('ポリシーを満たさないパスワードでは作成できない', async () => {
    await expect(
      createUser(hqAdmin, { email: emailOf('weak'), name: '弱い', role: 'HQ_STAFF', password: 'short1!' }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('代理店ロールは所属代理店の指定が必須', async () => {
    await expect(
      createUser(hqAdmin, { email: emailOf('noagency'), name: '代理店未指定', role: 'AGENCY_STAFF', password: PASSWORD }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('他組織の代理店は指定できない', async () => {
    await expect(
      createUser(hqAdmin, {
        email: emailOf('crossorg'),
        name: '越境',
        role: 'AGENCY_STAFF',
        agencyId: ids.otherAgency,
        password: PASSWORD,
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('作成すると資格情報アカウントと監査ログが残り、パスワードは平文で保存されない', async () => {
    const email = emailOf('created');
    const user = await createUser(hqAdmin, {
      email: email.toUpperCase(),
      name: '作成されたユーザー',
      role: 'AGENCY_ADMIN',
      agencyId: ids.agency,
      password: PASSWORD,
    });

    // メールアドレスは小文字へ正規化される（ログイン ID の揺れ防止）
    expect(user.email).toBe(email);
    expect(user.agencyId).toBe(ids.agency);
    expect(user.organizationId).toBe(ids.org);

    const account = await prisma.account.findFirst({ where: { userId: user.id, providerId: 'credential' } });
    expect(account).not.toBeNull();
    expect(account?.password).toBeTruthy();
    expect(account?.password).not.toContain(PASSWORD);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'user.create', entityId: user.id },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorUserId).toBe(ids.hqAdmin);
  });

  it('本部ロールには代理店を紐づけない', async () => {
    const user = await createUser(hqAdmin, {
      email: emailOf('hqstaff'),
      name: '本部スタッフ',
      role: 'HQ_STAFF',
      agencyId: ids.agency,
      password: PASSWORD,
    });
    expect(user.agencyId).toBeNull();
  });

  it('メールアドレスは重複できない', async () => {
    const email = emailOf('dup');
    await createUser(hqAdmin, { email, name: '重複1', role: 'HQ_STAFF', password: PASSWORD });
    await expect(
      createUser(hqAdmin, { email, name: '重複2', role: 'HQ_STAFF', password: PASSWORD }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe('データ分離（§4）', () => {
  it('一覧・詳細ともに他組織のユーザーは見えない', async () => {
    const rows = await listUsers(hqAdmin);
    expect(rows.some((u) => u.id === ids.otherOrgUser)).toBe(false);
    // URL 直接入力を想定した ID 指定でも取得できない
    expect(await findUserById(hqAdmin, ids.otherOrgUser)).toBeNull();
  });

  it('他組織のユーザーは更新もパスワード再設定もできない', async () => {
    expect(await updateUser(hqAdmin, ids.otherOrgUser, { name: '書き換え' })).toBeNull();
    expect(await resetUserPassword(hqAdmin, ids.otherOrgUser, PASSWORD)).toBeNull();

    const untouched = await prisma.user.findUnique({ where: { id: ids.otherOrgUser } });
    expect(untouched?.name).toBe(ids.otherOrgUser);
  });
});

describe('ユーザー更新のガード', () => {
  it('自分自身を無効化できない', async () => {
    await expect(updateUser(hqAdmin, ids.hqAdmin, { isActive: false })).rejects.toBeInstanceOf(DomainError);
  });

  it('自分自身のロールは変更できない', async () => {
    await expect(updateUser(hqAdmin, ids.hqAdmin, { role: 'HQ_STAFF' })).rejects.toBeInstanceOf(DomainError);
  });

  it('本部管理者は SUPER_ADMIN を変更できない', async () => {
    await expect(updateUser(hqAdmin, ids.superAdmin, { name: '書き換え' })).rejects.toBeInstanceOf(DomainError);
    await expect(resetUserPassword(hqAdmin, ids.superAdmin, PASSWORD)).rejects.toBeInstanceOf(DomainError);
  });

  it('組織で最後の管理者は無効化・降格できない', async () => {
    const soleOrgId = 'um-org-sole';
    await prisma.organization.upsert({
      where: { id: soleOrgId },
      update: {},
      create: { id: soleOrgId, code: 'UMSOLE', name: '管理者1名の組織' },
    });
    const adminId = 'um-user-sole-admin';
    await prisma.user.upsert({
      where: { id: adminId },
      update: { isActive: true, role: 'HQ_ADMIN' },
      create: {
        id: adminId,
        email: `${adminId}@example.jp`,
        name: '唯一の管理者',
        emailVerified: true,
        role: 'HQ_ADMIN',
        organizationId: soleOrgId,
        isActive: true,
      },
    });

    const operator: AccessContext = {
      userId: 'um-user-sole-operator',
      role: 'SUPER_ADMIN',
      organizationId: soleOrgId,
      agencyId: null,
      email: 'operator@example.jp',
      name: '運用者',
    };

    await expect(updateUser(operator, adminId, { isActive: false })).rejects.toBeInstanceOf(DomainError);
    await expect(updateUser(operator, adminId, { role: 'HQ_STAFF' })).rejects.toBeInstanceOf(DomainError);
  });

  it('無効化するとセッションが失効する', async () => {
    const user = await createUser(hqAdmin, {
      email: emailOf('deactivate'),
      name: '無効化対象',
      role: 'HQ_STAFF',
      password: PASSWORD,
    });
    await prisma.session.create({
      data: {
        id: `um-session-${user.id}`,
        userId: user.id,
        token: `um-token-${user.id}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const result = await updateUser(hqAdmin, user.id, { isActive: false });
    expect(result?.after.isActive).toBe(false);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe('パスワード再設定', () => {
  it('ハッシュが更新され、全セッションが失効し、監査ログが残る', async () => {
    const user = await createUser(hqAdmin, {
      email: emailOf('reset'),
      name: '再設定対象',
      role: 'HQ_STAFF',
      password: PASSWORD,
    });
    const before = await prisma.account.findFirst({ where: { userId: user.id, providerId: 'credential' } });
    await prisma.session.create({
      data: {
        id: `um-session-reset-${user.id}`,
        userId: user.id,
        token: `um-token-reset-${user.id}`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const NEW_PASSWORD = 'An0ther!Secret#2026';
    expect(await resetUserPassword(hqAdmin, user.id, NEW_PASSWORD)).not.toBeNull();

    const after = await prisma.account.findFirst({ where: { userId: user.id, providerId: 'credential' } });
    expect(after?.password).not.toBe(before?.password);
    expect(after?.password).not.toContain(NEW_PASSWORD);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);

    const audit = await prisma.auditLog.findFirst({ where: { action: 'user.password_reset', entityId: user.id } });
    expect(audit).not.toBeNull();
  });

  it('ポリシーを満たさないパスワードには再設定できない', async () => {
    const user = await createUser(hqAdmin, {
      email: emailOf('resetweak'),
      name: '弱い再設定',
      role: 'HQ_STAFF',
      password: PASSWORD,
    });
    await expect(resetUserPassword(hqAdmin, user.id, 'password123')).rejects.toBeInstanceOf(DomainError);
  });
});

describe('無効化したユーザーのログイン', () => {
  it('無効化されたユーザーにはセッションが発行されない', async () => {
    const { auth } = await import('@/server/auth/auth');
    const email = emailOf('signin');
    const user = await createUser(hqAdmin, {
      email,
      name: 'ログイン検証',
      role: 'HQ_STAFF',
      password: PASSWORD,
    });

    // 有効な間はログインできる
    await expect(auth.api.signInEmail({ body: { email, password: PASSWORD } })).resolves.toBeTruthy();

    await updateUser(hqAdmin, user.id, { isActive: false });

    // 無効化後はパスワードが正しくてもセッションを発行しない
    await expect(auth.api.signInEmail({ body: { email, password: PASSWORD } })).rejects.toThrow();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });
});
