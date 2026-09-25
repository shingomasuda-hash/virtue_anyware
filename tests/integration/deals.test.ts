import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { prisma } from '@/server/db';
import { AuthorizationError, type AccessContext } from '@/server/authz/context';
import { maskDealFinancials } from '@/server/authz/mask';
import { DomainError } from '@/lib/errors';
import {
  aggregateDealKpi,
  aggregatePipeline,
  findDealById,
  findDealCompensation,
  getDealFormOptions,
  listDeals,
} from '@/server/services/deals/repo';
import { createDeal, updateDeal, upsertDealCompensation, upsertDealProgress } from '@/server/services/deals/write';

/**
 * 案件管理（太陽光・蓄電池）の統合テスト。
 * docs/15_DEAL_MANAGEMENT.md 15.5 の認可要件が DB レベルで守られていることを確認する。
 */

const ids = {
  org: 'dl-org',
  otherOrg: 'dl-org-other',
  agencyA: 'dl-agency-a',
  agencyB: 'dl-agency-b',
  otherOrgAgency: 'dl-agency-other',
  statusAppointment: 'dl-status-appointment',
  statusContracted: 'dl-status-contracted',
  statusCompleted: 'dl-status-completed',
  statusLost: 'dl-status-lost',
  customerA: 'dl-customer-a',
  customerB: 'dl-customer-b',
  customerSelf: 'dl-customer-self',
  otherOrgCustomer: 'dl-customer-other-org',
  dealA: 'dl-deal-a',
  dealB: 'dl-deal-b',
  dealSelf: 'dl-deal-self',
};

function ctxOf(role: AccessContext['role'], agencyId: string | null): AccessContext {
  return { userId: `dl-u-${role}-${agencyId ?? 'hq'}`, role, organizationId: ids.org, agencyId, email: 'd@example.jp', name: 'D' };
}

const hqAdmin = ctxOf('HQ_ADMIN', null);
const hqStaff = ctxOf('HQ_STAFF', null);
const agencyA = ctxOf('AGENCY_ADMIN', ids.agencyA);
const agencyB = ctxOf('AGENCY_ADMIN', ids.agencyB);

const CONTRACTED_AT = new Date(2026, 8, 10);

beforeAll(async () => {
  execSync('npx prisma migrate deploy', { cwd: process.cwd(), stdio: 'ignore' });

  // 前回実行の残骸を消す
  await prisma.deal.deleteMany({ where: { organizationId: { in: [ids.org, ids.otherOrg] } } });

  for (const [id, code, name] of [
    [ids.org, 'DLORG', '案件テスト組織'],
    [ids.otherOrg, 'DLORG2', '別組織'],
  ] as const) {
    await prisma.organization.upsert({ where: { id }, update: {}, create: { id, code, name } });
  }
  for (const [id, organizationId, code, name] of [
    [ids.agencyA, ids.org, 'DL-A', '案件代理店A'],
    [ids.agencyB, ids.org, 'DL-B', '案件代理店B'],
    [ids.otherOrgAgency, ids.otherOrg, 'DL-X', '別組織の代理店'],
  ] as const) {
    await prisma.agency.upsert({ where: { id }, update: {}, create: { id, organizationId, code, name } });
  }

  const statusSeeds = [
    { id: ids.statusAppointment, code: 'DL_APPOINTMENT', label: 'アポ取得', sortOrder: 1, isOpen: true },
    { id: ids.statusContracted, code: 'DL_CONTRACTED', label: '契約', sortOrder: 2, isOpen: true, isContracted: true, stage: 'CONTRACT' as const },
    { id: ids.statusCompleted, code: 'DL_COMPLETED', label: '完工', sortOrder: 3, isWon: true, isContracted: true, stage: 'COMPLETED' as const },
    { id: ids.statusLost, code: 'DL_LOST', label: '失注', sortOrder: 4, isLost: true, stage: 'LOST' as const },
  ];
  for (const s of statusSeeds) {
    await prisma.dealStatus.upsert({
      where: { id: s.id },
      update: {},
      create: { organizationId: ids.org, ...s },
    });
  }

  for (const [id, organizationId, agencyId, name] of [
    [ids.customerA, ids.org, ids.agencyA, '代理店Aの顧客'],
    [ids.customerB, ids.org, ids.agencyB, '代理店Bの顧客'],
    [ids.customerSelf, ids.org, null, '自社直販の顧客'],
    [ids.otherOrgCustomer, ids.otherOrg, ids.otherOrgAgency, '別組織の顧客'],
  ] as const) {
    await prisma.customer.upsert({
      where: { id },
      update: {},
      create: { id, organizationId, agencyId, name },
    });
  }

  // 監査ログ・対応履歴が外部キーを持つため、操作者のユーザーを実際に作る
  for (const ctx of [hqAdmin, hqStaff, agencyA, agencyB]) {
    await prisma.user.upsert({
      where: { id: ctx.userId },
      update: {},
      create: {
        id: ctx.userId,
        email: `${ctx.userId}@example.jp`,
        name: ctx.userId,
        role: ctx.role,
        organizationId: ids.org,
        agencyId: ctx.agencyId,
      },
    });
  }

  // 代理店A / 代理店B / 自社直販 の案件を 1 件ずつ
  for (const [id, code, agencyId, customerId] of [
    [ids.dealA, 'T0001', ids.agencyA, ids.customerA],
    [ids.dealB, 'T0002', ids.agencyB, ids.customerB],
    [ids.dealSelf, 'T0003', null, ids.customerSelf],
  ] as const) {
    await prisma.deal.create({
      data: {
        id,
        organizationId: ids.org,
        code,
        agencyId,
        customerId,
        statusId: ids.statusContracted,
        productTypes: ['PV', 'BT'],
        contractedAt: CONTRACTED_AT,
        salesPriceExclTax: 3_000_000,
      },
    });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('データ分離（§4 / docs/15_DEAL_MANAGEMENT.md 15.5）', () => {
  it('本部は全案件、代理店は自代理店の案件のみ見える', async () => {
    const hqCodes = (await listDeals(hqAdmin)).map((d) => d.code);
    expect(hqCodes).toEqual(expect.arrayContaining(['T0001', 'T0002', 'T0003']));

    const codesA = (await listDeals(agencyA)).map((d) => d.code);
    expect(codesA).toEqual(['T0001']);
  });

  it('自社直販案件（agencyId = NULL）は代理店から 1 件も見えない', async () => {
    const deals = await listDeals(agencyA);
    expect(deals.some((d) => d.agencyId === null)).toBe(false);
    expect(await findDealById(agencyA, ids.dealSelf)).toBeNull();
  });

  it('URL に他代理店の案件 ID を入れても取得できない', async () => {
    expect(await findDealById(agencyA, ids.dealB)).toBeNull();
    expect(await findDealById(agencyB, ids.dealA)).toBeNull();
    // 自代理店のものは取得できる
    expect((await findDealById(agencyA, ids.dealA))?.code).toBe('T0001');
  });

  it('フィルタで他代理店を指定してもスコープと AND され 0 件になる', async () => {
    const deals = await listDeals(agencyA, { agencyId: ids.agencyB });
    expect(deals).toHaveLength(0);
  });

  it('代理店に所属していない代理店ロールはアクセスできない', async () => {
    await expect(listDeals(ctxOf('AGENCY_ADMIN', null))).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('フォームの選択肢も自代理店に限定される', async () => {
    const options = await getDealFormOptions(agencyA);
    expect(options.agencies.map((a) => a.id)).toEqual([ids.agencyA]);
    expect(options.customers.map((c) => c.id)).toEqual([ids.customerA]);
  });
});

describe('報酬の非公開（§17）', () => {
  beforeAll(async () => {
    await upsertDealCompensation(hqAdmin, ids.dealA, {
      equipmentCost: 1_500_000,
      constructionCost: 400_000,
      extendedWarrantyCost: 100_000,
      otherCost: 0,
      deductionAmount: 250_000,
      salesCommissionRate: 0.3,
      agencyCommissionRate: 0.2,
      paymentStatus: 'PENDING',
    });
  });

  it('本部管理者は報酬を取得できる', async () => {
    const compensation = await findDealCompensation(hqAdmin, ids.dealA);
    expect(compensation).not.toBeNull();
    expect(Number(compensation?.grossProfit)).toBe(1_000_000);
  });

  it('deal:compensation を持たないロールには報酬の取得経路が無い', async () => {
    expect(await findDealCompensation(hqStaff, ids.dealA)).toBeNull();
    expect(await findDealCompensation(agencyA, ids.dealA)).toBeNull();
  });

  it('KPI の営業利益合計は権限が無いロールには null で返る', async () => {
    const hqKpi = await aggregateDealKpi(hqAdmin, CONTRACTED_AT);
    expect(hqKpi.totalGrossProfit).toBe(1_000_000);

    for (const ctx of [hqStaff, agencyA]) {
      const kpi = await aggregateDealKpi(ctx, CONTRACTED_AT);
      expect(kpi.totalGrossProfit).toBeNull();
    }
  });

  it('マスキングは原価・粗利系のキーをオブジェクトから物理削除する', () => {
    const record = {
      dealId: ids.dealA,
      equipmentCost: 1,
      totalCost: 2,
      grossProfit: 3,
      deductionAmount: 4,
      commissionBase: 5,
      salesCommissionRate: 0.3,
      salesCommission: 6,
      companyGrossProfit: 7,
      agencyCommission: 8,
      agencyCommissionRate: 0.2,
    };
    const masked = maskDealFinancials(agencyA, record) as Record<string, unknown>;
    for (const key of ['equipmentCost', 'totalCost', 'grossProfit', 'deductionAmount', 'commissionBase', 'salesCommissionRate', 'salesCommission', 'companyGrossProfit']) {
      expect(key in masked).toBe(false);
    }
    // 代理店コミッションと支払状況は残す
    expect(masked.agencyCommission).toBe(8);
    expect(masked.agencyCommissionRate).toBe(0.2);
    // 本部には何も消さない
    expect(maskDealFinancials(hqAdmin, record)).toEqual(record);
  });
});

describe('案件の書き込み', () => {
  it('案件IDは A0001 形式で自動採番される', async () => {
    const deal = await createDeal(hqAdmin, {
      customerId: ids.customerSelf,
      statusId: ids.statusAppointment,
      productTypes: ['PV'],
      priority: 'MEDIUM',
    });
    expect(deal.code).toMatch(/^A\d{4}$/);
    expect(deal.agencyId).toBeNull();
  });

  it('同じ案件IDは登録できない', async () => {
    await expect(
      createDeal(hqAdmin, {
        code: 'T0001',
        customerId: ids.customerA,
        statusId: ids.statusAppointment,
        productTypes: ['PV'],
        priority: 'MEDIUM',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('代理店ロールは他代理店を指定して案件を作れない', async () => {
    await expect(
      createDeal(agencyA, {
        customerId: ids.customerA,
        agencyId: ids.agencyB,
        statusId: ids.statusAppointment,
        productTypes: ['PV'],
        priority: 'MEDIUM',
      }),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('スコープ外の顧客には案件を作れない', async () => {
    await expect(
      createDeal(agencyA, {
        customerId: ids.customerB,
        statusId: ids.statusAppointment,
        productTypes: ['PV'],
        priority: 'MEDIUM',
      }),
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      createDeal(hqAdmin, {
        customerId: ids.otherOrgCustomer,
        statusId: ids.statusAppointment,
        productTypes: ['PV'],
        priority: 'MEDIUM',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('他組織のマスタ（ステータス）は指定できない', async () => {
    const otherStatus = await prisma.dealStatus.upsert({
      where: { organizationId_code: { organizationId: ids.otherOrg, code: 'DL_X' } },
      update: {},
      create: { organizationId: ids.otherOrg, code: 'DL_X', label: '別組織のステータス' },
    });
    await expect(
      createDeal(hqAdmin, {
        customerId: ids.customerA,
        statusId: otherStatus.id,
        productTypes: ['PV'],
        priority: 'MEDIUM',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('他代理店の案件は更新できない', async () => {
    expect(await updateDeal(agencyA, ids.dealB, { priority: 'HIGH' })).toBeNull();
    const untouched = await prisma.deal.findUnique({ where: { id: ids.dealB }, select: { priority: true } });
    expect(untouched?.priority).toBe('MEDIUM');
  });

  it('ステータス変更は履歴と監査ログに残る', async () => {
    const result = await updateDeal(hqAdmin, ids.dealA, { statusId: ids.statusCompleted });
    expect(result?.after.statusId).toBe(ids.statusCompleted);

    const activity = await prisma.dealActivity.findFirst({
      where: { dealId: ids.dealA, type: 'STATUS_CHANGE', toStatusId: ids.statusCompleted },
    });
    expect(activity?.fromStatusId).toBe(ids.statusContracted);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'deal.status_change', entityId: ids.dealA },
    });
    expect(audit).not.toBeNull();

    // 元に戻す（後続テストの前提を壊さない）
    await updateDeal(hqAdmin, ids.dealA, { statusId: ids.statusContracted });
  });
});

describe('進捗と報酬', () => {
  it('他代理店の案件には進捗・報酬を保存できない', async () => {
    expect(
      await upsertDealProgress(agencyA, ids.dealB, {
        loanReview: 'NOT_STARTED',
        siteSurvey: 'NOT_STARTED',
        subsidy: 'NOT_REQUIRED',
        construction: 'NOT_STARTED',
        completionCheck: 'NOT_STARTED',
        paymentStatus: 'PENDING',
        contractDocument: 'NOT_STARTED',
        importantMatters: 'NOT_STARTED',
        warranty: 'NOT_STARTED',
        sitePhotos: 'NOT_STARTED',
        gridConnection: 'NOT_STARTED',
      }),
    ).toBeNull();
  });

  it('販売価格が無い案件には報酬を保存できない', async () => {
    const deal = await createDeal(hqAdmin, {
      customerId: ids.customerA,
      statusId: ids.statusAppointment,
      productTypes: ['BT'],
      priority: 'LOW',
    });
    await expect(
      upsertDealCompensation(hqAdmin, deal.id, {
        equipmentCost: 100,
        constructionCost: 0,
        extendedWarrantyCost: 0,
        otherCost: 0,
        deductionAmount: 0,
        salesCommissionRate: 0.3,
        agencyCommissionRate: 0.2,
        paymentStatus: 'PENDING',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it('報酬の金額はサーバー側の計算結果が保存され、監査ログに残る', async () => {
    const saved = await upsertDealCompensation(hqAdmin, ids.dealB, {
      equipmentCost: 1_500_000,
      constructionCost: 400_000,
      extendedWarrantyCost: 100_000,
      otherCost: 0,
      deductionAmount: 250_000,
      salesCommissionRate: 0.35,
      agencyCommissionRate: 0.25,
      paymentStatus: 'PENDING',
    });

    // 販売価格 3,000,000 − 原価 2,000,000 = 営業利益 1,000,000
    // 対象額 750,000 → 営業 262,500 / 代理店 187,500 / 会社残 550,000
    expect(Number(saved?.totalCost)).toBe(2_000_000);
    expect(Number(saved?.grossProfit)).toBe(1_000_000);
    expect(Number(saved?.commissionBase)).toBe(750_000);
    expect(Number(saved?.salesCommission)).toBe(262_500);
    expect(Number(saved?.agencyCommission)).toBe(187_500);
    expect(Number(saved?.companyGrossProfit)).toBe(550_000);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'deal.compensation_update', entityId: ids.dealB },
    });
    expect(audit).not.toBeNull();
  });

  it('率を % のまま渡すと保存されない', async () => {
    await expect(
      upsertDealCompensation(hqAdmin, ids.dealA, {
        equipmentCost: 0,
        constructionCost: 0,
        extendedWarrantyCost: 0,
        otherCost: 0,
        deductionAmount: 0,
        salesCommissionRate: 30,
        agencyCommissionRate: 0.2,
        paymentStatus: 'PENDING',
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe('集計', () => {
  it('ファネルはステータスマスタの全行を順番どおり返す', async () => {
    const rows = await aggregatePipeline(hqAdmin);
    expect(rows.map((r) => r.code)).toEqual(['DL_APPOINTMENT', 'DL_CONTRACTED', 'DL_COMPLETED', 'DL_LOST']);
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    expect(total).toBe(await prisma.deal.count({ where: { organizationId: ids.org, deletedAt: null } }));
  });

  it('代理店のファネルには自代理店の案件しか含まれない', async () => {
    const rows = await aggregatePipeline(agencyA);
    const total = rows.reduce((sum, r) => sum + r.count, 0);
    expect(total).toBe(await prisma.deal.count({ where: { organizationId: ids.org, agencyId: ids.agencyA, deletedAt: null } }));
  });
});
