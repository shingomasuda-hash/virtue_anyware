import { AuthorizationError, isAgencyScoped, type AccessContext } from './context';

/** organization / agency によるテナント分離 where 句。 */
export interface TenantScope {
  organizationId?: string;
  agencyId?: string;
}

/**
 * 販売系（顧客・契約・精算など agencyId を持つ）テーブル用のスコープ。
 *
 * - SUPER_ADMIN            : 全組織（制約なし）
 * - HQ_ADMIN / HQ_STAFF    : 自組織のみ
 * - AGENCY_ADMIN / STAFF   : 自組織 かつ 自代理店のみ
 *
 * 一覧・単体取得・更新・削除・集計のすべてでこれを AND すること。
 */
export function agencyScope(ctx: AccessContext): TenantScope {
  if (ctx.role === 'SUPER_ADMIN') return {};
  if (!ctx.organizationId) {
    throw new AuthorizationError('組織に所属していないユーザーはデータへアクセスできません。');
  }
  if (isAgencyScoped(ctx)) {
    if (!ctx.agencyId) {
      throw new AuthorizationError('代理店に所属していないユーザーはデータへアクセスできません。');
    }
    return { organizationId: ctx.organizationId, agencyId: ctx.agencyId };
  }
  return { organizationId: ctx.organizationId };
}

/** 組織単位のみで分離するテーブル（マスタ・催事・経費など）用。 */
export function orgScope(ctx: AccessContext): Pick<TenantScope, 'organizationId'> {
  if (ctx.role === 'SUPER_ADMIN') return {};
  if (!ctx.organizationId) {
    throw new AuthorizationError('組織に所属していないユーザーはデータへアクセスできません。');
  }
  return { organizationId: ctx.organizationId };
}

/**
 * 「id 指定の取得」でも findUnique を使わず、この where を通すこと。
 * URL / API に他代理店の ID を直接入れても 0 件になる。
 */
export function scopedById(ctx: AccessContext, id: string): TenantScope & { id: string } {
  return { id, ...agencyScope(ctx) };
}

/**
 * 書き込み時の agencyId 決定。
 * 代理店ロールではクライアント入力を信用せず、必ず自代理店を強制する。
 */
export function resolveWritableAgencyId(ctx: AccessContext, requested?: string | null): string | null {
  if (isAgencyScoped(ctx)) {
    if (requested && requested !== ctx.agencyId) {
      throw new AuthorizationError('他代理店のデータは作成・更新できません。');
    }
    return ctx.agencyId;
  }
  return requested ?? null;
}

/** 代理店ロールが特定代理店のデータへアクセスしてよいかの明示チェック。 */
export function assertAgencyAccess(ctx: AccessContext, agencyId: string | null | undefined): void {
  if (!isAgencyScoped(ctx)) return;
  if (!agencyId || agencyId !== ctx.agencyId) {
    throw new AuthorizationError('他代理店のデータへはアクセスできません。');
  }
}
