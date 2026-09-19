import type { UserRole } from '@/generated/prisma';
import { isAgencyRole } from './roles';
import { roleHasPermission, type Permission } from './permissions';

/**
 * 全ての DB アクセス・サービス呼び出しに必須のアクセス文脈。
 * これを引数に取らない repository を作ってはならない。
 */
export interface AccessContext {
  readonly userId: string;
  readonly role: UserRole;
  readonly organizationId: string | null;
  readonly agencyId: string | null;
  readonly email: string;
  readonly name: string;
}

export class AuthorizationError extends Error {
  readonly code = 'FORBIDDEN';
  constructor(message = 'この操作を行う権限がありません。') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class AuthenticationError extends Error {
  readonly code = 'UNAUTHENTICATED';
  constructor(message = 'ログインが必要です。') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export function can(ctx: AccessContext, permission: Permission): boolean {
  return roleHasPermission(ctx.role, permission);
}

export function requirePermission(ctx: AccessContext, permission: Permission): void {
  if (!can(ctx, permission)) {
    throw new AuthorizationError(`権限 ${permission} が必要です。`);
  }
}

export function requireAnyPermission(ctx: AccessContext, permissions: readonly Permission[]): void {
  if (!permissions.some((p) => can(ctx, p))) {
    throw new AuthorizationError('この操作を行う権限がありません。');
  }
}

/**
 * 本部財務情報（本部単価 / 本部売上 / 粗利 / 粗利率）を見られるか。
 * false のときは service 層でフィールドごと削除する（UI で隠すだけにしない）。
 */
export function canViewHqFinancials(ctx: AccessContext): boolean {
  return can(ctx, 'finance:hq');
}

/** 代理店に閉じたユーザーか。true のとき agencyId が必須。 */
export function isAgencyScoped(ctx: AccessContext): boolean {
  return isAgencyRole(ctx.role);
}
