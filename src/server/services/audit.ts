import { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';

/** 監査対象アクション（docs/12_SECURITY.md）。 */
export type AuditAction =
  | 'customer.create'
  | 'customer.update'
  | 'customer.delete'
  | 'contract.create'
  | 'contract.update'
  | 'contract.cancel'
  | 'contract.reprice'
  | 'pricing.create'
  | 'pricing.update'
  | 'agency.create'
  | 'agency.update'
  | 'import.commit'
  | 'import.rollback'
  | 'settlement.confirm'
  | 'expense.approve'
  | 'user.role_change'
  | 'export.csv'
  | 'auth.login';

/** 監査ログへ添えるリクエスト情報（IP / UA）。 */
export interface AuditRequestInfo {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuditInput extends AuditRequestInfo {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  /** 財務データ変更は before / after を必ず記録する（§27）。 */
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
}

/**
 * 監査ログ記録。記録失敗が業務処理を巻き込まないよう例外は握りつぶし、
 * サーバーログにのみ残す。
 */
export async function recordAudit(ctx: AccessContext, input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        agencyId: ctx.agencyId,
        actorUserId: ctx.userId,
        actorRole: ctx.role,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        before: input.before ?? Prisma.JsonNull,
        after: input.after ?? Prisma.JsonNull,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    console.error('[audit] 監査ログの記録に失敗しました', { action: input.action, error });
  }
}
