import { hashPassword } from 'better-auth/crypto';
import type { Prisma, UserRole } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { orgScope } from '@/server/authz/scope';
import { isAgencyRole } from '@/server/authz/roles';
import { recordAudit, type AuditRequestInfo } from '@/server/services/audit';
import { DomainError } from '@/lib/errors';
import { validatePassword } from '@/lib/password';

export interface UserWriteInput {
  email: string;
  name: string;
  role: UserRole;
  agencyId?: string | null;
  phone?: string | null;
  isActive?: boolean;
}

function snapshotOf(user: {
  email: string;
  name: string;
  role: UserRole;
  agencyId: string | null;
  isActive: boolean;
}): Prisma.InputJsonValue {
  return {
    email: user.email,
    name: user.name,
    role: user.role,
    agencyId: user.agencyId,
    isActive: user.isActive,
  };
}

/**
 * 付与しようとしているロールが、操作者の権限で許されるかを検証する。
 *
 * SUPER_ADMIN を作れるのは SUPER_ADMIN だけ。
 * HQ_ADMIN が SUPER_ADMIN を作れてしまうと権限昇格の抜け道になる。
 */
function assertCanAssignRole(ctx: AccessContext, role: UserRole): void {
  if (role === 'SUPER_ADMIN' && ctx.role !== 'SUPER_ADMIN') {
    throw new DomainError('システム管理者（SUPER_ADMIN）を作成・変更できるのはシステム管理者のみです。');
  }
}

/** 代理店ロールには代理店の指定が必須。本部ロールには代理店を紐づけない。 */
async function resolveAgencyId(
  ctx: AccessContext,
  role: UserRole,
  requested: string | null | undefined,
): Promise<string | null> {
  if (!isAgencyRole(role)) return null;

  if (!requested) {
    throw new DomainError('代理店ロールのユーザーには所属代理店を指定してください。');
  }
  const scope = orgScope(ctx);
  const agency = await prisma.agency.findFirst({
    where: { AND: [scope.organizationId ? { organizationId: scope.organizationId } : {}, { id: requested }, { deletedAt: null }] },
    select: { id: true },
  });
  if (!agency) throw new DomainError('指定された代理店が見つかりません。');
  return agency.id;
}

/** 自分自身を締め出す操作を防ぐ。 */
function assertNotSelfLockout(ctx: AccessContext, targetUserId: string, change: { role?: UserRole; isActive?: boolean }): void {
  if (ctx.userId !== targetUserId) return;
  if (change.isActive === false) {
    throw new DomainError('自分自身を無効化することはできません。');
  }
  if (change.role && change.role !== ctx.role) {
    throw new DomainError('自分自身のロールは変更できません。別の管理者に依頼してください。');
  }
}

/** 組織内の最後の有効な管理者を失わないようにする。 */
async function assertNotLastAdmin(
  organizationId: string | null,
  targetUserId: string,
  change: { role?: UserRole; isActive?: boolean },
): Promise<void> {
  const losingAdmin = change.isActive === false || (change.role !== undefined && !['SUPER_ADMIN', 'HQ_ADMIN'].includes(change.role));
  if (!losingAdmin) return;

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true, isActive: true } });
  if (!target || !['SUPER_ADMIN', 'HQ_ADMIN'].includes(target.role) || !target.isActive) return;

  const remaining = await prisma.user.count({
    where: {
      ...(organizationId ? { organizationId } : {}),
      role: { in: ['SUPER_ADMIN', 'HQ_ADMIN'] },
      isActive: true,
      NOT: { id: targetUserId },
    },
  });
  if (remaining === 0) {
    throw new DomainError('組織に管理者がいなくなるため、この操作は実行できません。先に別の管理者を作成してください。');
  }
}

function userScopeWhere(ctx: AccessContext): Prisma.UserWhereInput {
  const scope = orgScope(ctx);
  return scope.organizationId ? { organizationId: scope.organizationId } : {};
}

export async function listUsers(ctx: AccessContext) {
  return prisma.user.findMany({
    where: userScopeWhere(ctx),
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    include: { agency: { select: { id: true, name: true, code: true } } },
  });
}

export async function findUserById(ctx: AccessContext, id: string) {
  return prisma.user.findFirst({
    where: { AND: [userScopeWhere(ctx), { id }] },
    include: { agency: { select: { id: true, name: true, code: true } } },
  });
}

/**
 * ユーザーを作成する。
 * 招待メールの仕組みが無いため、作成時に初期パスワードを設定して管理者が伝える運用。
 */
export async function createUser(
  ctx: AccessContext,
  input: UserWriteInput & { password: string },
  request?: AuditRequestInfo,
) {
  assertCanAssignRole(ctx, input.role);

  const issues = validatePassword(input.password);
  if (issues.length > 0) throw new DomainError(issues.map((i) => i.message).join(' '));

  const scope = orgScope(ctx);
  const organizationId = scope.organizationId ?? ctx.organizationId;
  if (!organizationId) throw new DomainError('組織が特定できないためユーザーを作成できません。');

  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) throw new DomainError(`メールアドレス ${email} は既に登録されています。`);

  const agencyId = await resolveAgencyId(ctx, input.role, input.agencyId);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name: input.name.trim(),
        emailVerified: true,
        role: input.role,
        organizationId,
        agencyId,
        phone: input.phone?.trim() || null,
        isActive: input.isActive ?? true,
      },
    });
    await tx.account.create({
      data: {
        userId: created.id,
        providerId: 'credential',
        accountId: created.id,
        password: await hashPassword(input.password),
      },
    });
    return created;
  });

  await recordAudit(ctx, {
    action: 'user.create',
    entity: 'user',
    entityId: user.id,
    before: null,
    after: snapshotOf(user),
    ...request,
  });

  return user;
}

export async function updateUser(
  ctx: AccessContext,
  id: string,
  input: Partial<UserWriteInput>,
  request?: AuditRequestInfo,
) {
  const before = await prisma.user.findFirst({ where: { AND: [userScopeWhere(ctx), { id }] } });
  if (!before) return null;

  // 既存が SUPER_ADMIN の場合、変更できるのは SUPER_ADMIN のみ
  if (before.role === 'SUPER_ADMIN' && ctx.role !== 'SUPER_ADMIN') {
    throw new DomainError('システム管理者の情報を変更できるのはシステム管理者のみです。');
  }
  if (input.role) assertCanAssignRole(ctx, input.role);

  assertNotSelfLockout(ctx, id, { role: input.role, isActive: input.isActive });
  await assertNotLastAdmin(before.organizationId, id, { role: input.role, isActive: input.isActive });

  const role = input.role ?? before.role;
  const agencyId =
    input.role === undefined && input.agencyId === undefined
      ? before.agencyId
      : await resolveAgencyId(ctx, role, input.agencyId ?? before.agencyId);

  if (input.email && input.email.trim().toLowerCase() !== before.email) {
    const email = input.email.trim().toLowerCase();
    const duplicate = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (duplicate) throw new DomainError(`メールアドレス ${email} は既に登録されています。`);
  }

  const after = await prisma.user.update({
    where: { id },
    data: {
      email: input.email === undefined ? undefined : input.email.trim().toLowerCase(),
      name: input.name === undefined ? undefined : input.name.trim(),
      role: input.role,
      agencyId,
      phone: input.phone === undefined ? undefined : (input.phone?.trim() || null),
      isActive: input.isActive,
    },
  });

  await recordAudit(ctx, {
    action: 'user.role_change',
    entity: 'user',
    entityId: id,
    before: snapshotOf(before),
    after: snapshotOf(after),
    ...request,
  });

  // 無効化した場合はセッションを失効させ、即座にアクセスを断つ
  if (before.isActive && after.isActive === false) {
    await prisma.session.deleteMany({ where: { userId: id } });
  }

  return { before, after };
}

/**
 * 管理者によるパスワード再設定。
 * 現在のパスワードを知らなくても設定できるため、監査ログに必ず残す。
 */
export async function resetUserPassword(
  ctx: AccessContext,
  id: string,
  newPassword: string,
  request?: AuditRequestInfo,
) {
  const target = await prisma.user.findFirst({ where: { AND: [userScopeWhere(ctx), { id }] } });
  if (!target) return null;

  if (target.role === 'SUPER_ADMIN' && ctx.role !== 'SUPER_ADMIN') {
    throw new DomainError('システム管理者のパスワードを再設定できるのはシステム管理者のみです。');
  }

  const issues = validatePassword(newPassword);
  if (issues.length > 0) throw new DomainError(issues.map((i) => i.message).join(' '));

  const hashed = await hashPassword(newPassword);
  const account = await prisma.account.findFirst({
    where: { userId: id, providerId: 'credential' },
    select: { id: true },
  });

  if (account) {
    await prisma.account.update({ where: { id: account.id }, data: { password: hashed } });
  } else {
    await prisma.account.create({
      data: { userId: id, providerId: 'credential', accountId: id, password: hashed },
    });
  }

  // 再設定後は既存セッションを無効化する（乗っ取り時の締め出しを確実にする）
  await prisma.session.deleteMany({ where: { userId: id } });

  await recordAudit(ctx, {
    action: 'user.password_reset',
    entity: 'user',
    entityId: id,
    after: { email: target.email, resetBy: ctx.email },
    ...request,
  });

  return target;
}

/** 本人によるパスワード変更後に、他端末のセッションを切る。 */
export async function recordPasswordChange(ctx: AccessContext, request?: AuditRequestInfo) {
  await recordAudit(ctx, {
    action: 'user.password_change',
    entity: 'user',
    entityId: ctx.userId,
    after: { email: ctx.email },
    ...request,
  });
}

/** ユーザー作成フォームの選択肢。 */
export async function getUserFormOptions(ctx: AccessContext) {
  const scope = orgScope(ctx);
  const agencies = await prisma.agency.findMany({
    where: { ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), deletedAt: null },
    orderBy: { code: 'asc' },
    select: { id: true, name: true, code: true },
  });
  return { agencies };
}

/**
 * 操作者が付与できるロール。
 * SUPER_ADMIN は SUPER_ADMIN のみが付与できるため、それ以外には選択肢として出さない。
 * （画面から消すだけでなく createUser / updateUser でも同じ判定を行う。）
 */
export function assignableRoles(ctx: AccessContext): readonly UserRole[] {
  const base: readonly UserRole[] = ['HQ_ADMIN', 'HQ_STAFF', 'AGENCY_ADMIN', 'AGENCY_STAFF'];
  return ctx.role === 'SUPER_ADMIN' ? (['SUPER_ADMIN', ...base] as const) : base;
}
