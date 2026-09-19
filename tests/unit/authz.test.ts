import { describe, expect, it } from 'vitest';
import { AuthorizationError, can, canViewHqFinancials, requirePermission } from '@/server/authz/context';
import { agencyScope, orgScope, resolveWritableAgencyId, assertAgencyAccess } from '@/server/authz/scope';
import { maskHqFinancials, maskHqFinancialsList, HQ_FINANCIAL_FIELDS } from '@/server/authz/mask';
import type { AccessContext } from '@/server/authz/context';
import type { UserRole } from '@/generated/prisma';

function ctxOf(role: UserRole, agencyId: string | null = null): AccessContext {
  return { userId: `u-${role}`, role, organizationId: 'org1', agencyId, email: 'x@example.jp', name: 'テスト' };
}

const hqAdmin = ctxOf('HQ_ADMIN');
const hqStaff = ctxOf('HQ_STAFF');
const agencyAdminA = ctxOf('AGENCY_ADMIN', 'agencyA');
const agencyStaffA = ctxOf('AGENCY_STAFF', 'agencyA');
const superAdmin = ctxOf('SUPER_ADMIN');

describe('スコープ生成（§4 データ分離）', () => {
  it('代理店ロールの where には必ず agencyId が入る', () => {
    expect(agencyScope(agencyAdminA)).toEqual({ organizationId: 'org1', agencyId: 'agencyA' });
    expect(agencyScope(agencyStaffA)).toEqual({ organizationId: 'org1', agencyId: 'agencyA' });
  });

  it('本部ロールは組織単位、SUPER_ADMIN は無制約', () => {
    expect(agencyScope(hqAdmin)).toEqual({ organizationId: 'org1' });
    expect(agencyScope(superAdmin)).toEqual({});
    expect(orgScope(hqStaff)).toEqual({ organizationId: 'org1' });
  });

  it('代理店に所属していない代理店ロールはアクセスできない', () => {
    expect(() => agencyScope(ctxOf('AGENCY_ADMIN', null))).toThrow(AuthorizationError);
  });

  it('書き込み時、代理店ロールは他代理店を指定できない', () => {
    expect(resolveWritableAgencyId(agencyAdminA, 'agencyA')).toBe('agencyA');
    // クライアント入力を無視して自代理店を強制する
    expect(resolveWritableAgencyId(agencyAdminA, undefined)).toBe('agencyA');
    expect(() => resolveWritableAgencyId(agencyAdminA, 'agencyB')).toThrow(AuthorizationError);
    // 本部は任意の代理店を指定できる
    expect(resolveWritableAgencyId(hqAdmin, 'agencyB')).toBe('agencyB');
  });

  it('代理店ロールが他代理店 ID へ触れようとすると例外になる', () => {
    expect(() => assertAgencyAccess(agencyAdminA, 'agencyB')).toThrow(AuthorizationError);
    expect(() => assertAgencyAccess(agencyAdminA, null)).toThrow(AuthorizationError);
    expect(() => assertAgencyAccess(agencyAdminA, 'agencyA')).not.toThrow();
    expect(() => assertAgencyAccess(hqAdmin, 'agencyB')).not.toThrow();
  });
});

describe('本部財務情報の秘匿（§17 / §35）', () => {
  it('代理店ロールは finance:hq 権限を持たない', () => {
    expect(canViewHqFinancials(hqAdmin)).toBe(true);
    expect(canViewHqFinancials(hqStaff)).toBe(true);
    expect(canViewHqFinancials(agencyAdminA)).toBe(false);
    expect(canViewHqFinancials(agencyStaffA)).toBe(false);
  });

  it('§35: 代理店ユーザーへ返す DTO から本部金額フィールドが物理的に消える', () => {
    const record = {
      id: 'c1',
      contractWatt: 5000,
      agencyUnitPrice: 100,
      agencyPayout: 500_000,
      hqUnitPrice: 150,
      hqRevenue: 750_000,
      hqGrossProfit: 250_000,
      grossMargin: 0.3333,
    };

    const masked = maskHqFinancials(agencyAdminA, record) as Record<string, unknown>;
    for (const field of HQ_FINANCIAL_FIELDS) {
      // 「画面で隠す」ではなく、キー自体が存在しないこと
      expect(field in masked).toBe(false);
    }
    // 代理店が見てよい金額は残る
    expect(masked.agencyPayout).toBe(500_000);
    expect(masked.agencyUnitPrice).toBe(100);

    // 本部ユーザーには全フィールドが残る
    const forHq = maskHqFinancials(hqAdmin, record) as Record<string, unknown>;
    expect(forHq.hqGrossProfit).toBe(250_000);
  });

  it('一覧でも同様にマスクされる', () => {
    const rows = [
      { id: 'a', hqRevenue: 1, agencyPayout: 2 },
      { id: 'b', hqRevenue: 3, agencyPayout: 4 },
    ];
    const masked = maskHqFinancialsList(agencyStaffA, rows) as Array<Record<string, unknown>>;
    expect(masked.every((r) => !('hqRevenue' in r))).toBe(true);
    expect(masked.every((r) => 'agencyPayout' in r)).toBe(true);
  });
});

describe('パーミッション（docs/04_RBAC.md 4.2）', () => {
  it('代理店ロールは単価編集・CSV取込・監査ログ・アップセルにアクセスできない', () => {
    for (const ctx of [agencyAdminA, agencyStaffA]) {
      expect(can(ctx, 'pricing:write')).toBe(false);
      expect(can(ctx, 'import:run')).toBe(false);
      expect(can(ctx, 'audit:read')).toBe(false);
      expect(can(ctx, 'upsell:read')).toBe(false);
      expect(can(ctx, 'finance:hq')).toBe(false);
    }
  });

  it('本部スタッフは単価を閲覧できるが変更できない', () => {
    expect(can(hqStaff, 'pricing:read')).toBe(true);
    expect(can(hqStaff, 'pricing:write')).toBe(false);
    expect(() => requirePermission(hqStaff, 'pricing:write')).toThrow(AuthorizationError);
  });

  it('本部管理者は代理店作成・CSV取込・CSV出力ができる', () => {
    expect(can(hqAdmin, 'agency:write')).toBe(true);
    expect(can(hqAdmin, 'import:run')).toBe(true);
    expect(can(hqAdmin, 'export:csv')).toBe(true);
  });

  it('SUPER_ADMIN はすべての権限を持つ', () => {
    expect(can(superAdmin, 'org:manage')).toBe(true);
    expect(can(superAdmin, 'audit:read')).toBe(true);
  });

  it('代理店スタッフは顧客を編集できるが契約は編集できない', () => {
    expect(can(agencyStaffA, 'customer:write')).toBe(true);
    expect(can(agencyStaffA, 'contract:write')).toBe(false);
  });
});
