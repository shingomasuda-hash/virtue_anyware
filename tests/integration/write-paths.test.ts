import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { AuthorizationError } from '@/server/authz/context';
import { createCustomer, updateCustomer } from '@/server/services/customers';
import { cancelContract, createContract, repriceContract, updateContract } from '@/server/services/contract-write';
import { addAgencyUnitPrice, createAgency, updateAgency } from '@/server/services/agencies';
import { findContractFacts } from '@/server/repositories/contract.repo';
import { aggregateSalesKpi } from '@/server/services/kpi';
import { toNumber } from '@/lib/money';

/**
 * 書き込み経路（Server Action → service）の統合テスト。
 * 認可・単価スナップショット・監査ログが実際に機能することを DB で検証する。
 */

const ids = {
  org: 'wt-org',
  agencyA: 'wt-agency-a',
  agencyB: 'wt-agency-b',
  product: 'wt-product',
  statusActive: 'wt-status-active',
  statusCancelled: 'wt-status-cancelled',
  customerB: 'wt-customer-b',
};

function ctxOf(role: AccessContext['role'], agencyId: string | null): AccessContext {
  return { userId: `wt-u-${role}`, role, organizationId: ids.org, agencyId, email: 'w@example.jp', name: 'W' };
}

const hq = ctxOf('HQ_ADMIN', null);
const hqStaff = ctxOf('HQ_STAFF', null);
const agencyA = ctxOf('AGENCY_ADMIN', ids.agencyA);
const agencyB = ctxOf('AGENCY_ADMIN', ids.agencyB);

const CONTRACTED_AT = new Date(2026, 6, 15);

beforeAll(async () => {
  execSync('npx prisma migrate deploy', { cwd: process.cwd(), stdio: 'ignore' });

  await prisma.organization.upsert({
    where: { id: ids.org },
    update: {},
    create: { id: ids.org, code: 'WTORG', name: '書き込みテスト組織' },
  });
  for (const [id, code, name] of [
    [ids.agencyA, 'WT-A', '書込代理店A'],
    [ids.agencyB, 'WT-B', '書込代理店B'],
  ] as const) {
    await prisma.agency.upsert({ where: { id }, update: {}, create: { id, organizationId: ids.org, code, name } });
  }
  await prisma.product.upsert({
    where: { id: ids.product },
    update: {},
    create: { id: ids.product, organizationId: ids.org, code: 'WT-ELEC', name: '電力', category: 'ELECTRICITY', quantityUnit: 'WATT' },
  });
  await prisma.contractStatus.upsert({
    where: { id: ids.statusActive },
    update: {},
    create: { id: ids.statusActive, organizationId: ids.org, code: 'WT-ACTIVE', label: '開通済', isActiveContract: true, sortOrder: 1 },
  });
  await prisma.contractStatus.upsert({
    where: { id: ids.statusCancelled },
    update: {},
    create: { id: ids.statusCancelled, organizationId: ids.org, code: 'WT-CANCEL', label: 'キャンセル', isActiveContract: false, isCancelled: true, sortOrder: 9 },
  });

  // 本部受取 150 円/W、代理店A 支払 100 円/W（2026-01-01〜）
  await prisma.pricingRule.deleteMany({ where: { organizationId: ids.org } });
  await prisma.pricingRule.create({
    data: {
      organizationId: ids.org,
      side: 'HQ_RECEIVE',
      productId: ids.product,
      unitType: 'PER_WATT',
      unitPrice: new Prisma.Decimal(150),
      effectiveFrom: new Date(2026, 0, 1),
    },
  });
  await prisma.agencyUnitPrice.deleteMany({ where: { agencyId: { in: [ids.agencyA, ids.agencyB] } } });
  await prisma.agencyUnitPrice.create({
    data: {
      agencyId: ids.agencyA,
      productId: ids.product,
      unitType: 'PER_WATT',
      unitPrice: new Prisma.Decimal(100),
      effectiveFrom: new Date(2026, 0, 1),
    },
  });

  // 監査ログ・活動履歴は actorUserId の FK を持つため、実ユーザーを用意する
  for (const ctx of [hq, hqStaff, agencyA, agencyB]) {
    await prisma.user.upsert({
      where: { id: ctx.userId },
      update: {},
      create: {
        id: ctx.userId,
        email: `${ctx.userId}@example.jp`,
        name: ctx.name,
        role: ctx.role,
        organizationId: ids.org,
        agencyId: ctx.agencyId,
      },
    });
  }

  await prisma.customer.upsert({
    where: { id: ids.customerB },
    update: {},
    create: { id: ids.customerB, organizationId: ids.org, agencyId: ids.agencyB, name: '代理店Bの顧客' },
  });
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('顧客登録・代理店紐付け', () => {
  it('本部管理者は任意の代理店を指定して顧客を登録できる', async () => {
    const customer = await createCustomer(hq, { name: 'HQが登録した顧客', agencyId: ids.agencyA, phone: '090-1111-2222' });
    expect(customer.agencyId).toBe(ids.agencyA);
    // 電話番号は重複判定キーとして正規化保存される
    expect(customer.phoneNormalized).toBe('09011112222');
  });

  it('代理店ユーザーが他代理店を指定しても拒否される（入力を信用しない）', async () => {
    await expect(createCustomer(agencyA, { name: '不正登録', agencyId: ids.agencyB })).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it('代理店ユーザーが代理店を未指定でも自社に強制される', async () => {
    const customer = await createCustomer(agencyA, { name: '代理店Aが登録した顧客' });
    expect(customer.agencyId).toBe(ids.agencyA);
  });

  it('他代理店の顧客は更新できない（スコープ外は null）', async () => {
    expect(await updateCustomer(agencyA, ids.customerB, { name: '書き換え' })).toBeNull();
    // 本部は更新できる
    const result = await updateCustomer(hq, ids.customerB, { name: '代理店Bの顧客（更新）' });
    expect(result?.updated.name).toBe('代理店Bの顧客（更新）');
  });

  it('顧客更新で監査ログに変更前後が記録される', async () => {
    const customer = await createCustomer(hq, { name: '監査対象顧客', phone: '09000000001', agencyId: ids.agencyA });
    await updateCustomer(hq, customer.id, { name: '監査対象顧客（改名）' });

    const log = await prisma.auditLog.findFirst({
      where: { entity: 'customer', entityId: customer.id, action: 'customer.update' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).not.toBeNull();
    expect((log?.before as Record<string, unknown>).name).toBe('監査対象顧客');
    expect((log?.after as Record<string, unknown>).name).toBe('監査対象顧客（改名）');
    expect(log?.actorRole).toBe('HQ_ADMIN');
  });
});

describe('契約登録と単価スナップショット', () => {
  it('§35 の計算例: 5,000W / 150円 / 100円 → 750,000・500,000・250,000 が DB に保存される', async () => {
    const customer = await createCustomer(hq, { name: '計算検証顧客', agencyId: ids.agencyA });
    const contract = await createContract(hq, {
      customerId: customer.id,
      productId: ids.product,
      contractNumber: `WT-CALC-${Date.now()}`,
      contractWatt: 5000,
      statusId: ids.statusActive,
      contractedAt: CONTRACTED_AT,
    });

    expect(toNumber(contract.hqUnitPrice)).toBe(150);
    expect(toNumber(contract.agencyUnitPrice)).toBe(100);
    expect(toNumber(contract.hqRevenue)).toBe(750_000);
    expect(toNumber(contract.agencyPayout)).toBe(500_000);
    expect(toNumber(contract.hqGrossProfit)).toBe(250_000);
    expect(toNumber(contract.grossMargin)).toBeCloseTo(0.3333, 4);

    // 計算根拠がスナップショット履歴に残る
    const snapshot = await prisma.contractPricingSnapshot.findFirst({ where: { contractId: contract.id } });
    expect(snapshot?.hqPricingRuleId).not.toBeNull();
    expect(toNumber(snapshot?.hqGrossProfit ?? 0)).toBe(250_000);

    // 監査ログに財務値が残る
    const log = await prisma.auditLog.findFirst({ where: { entity: 'contract', entityId: contract.id, action: 'contract.create' } });
    expect((log?.after as Record<string, unknown>).hqGrossProfit).toBe(250_000);
  });

  it('契約登録でアップセルリードが自動生成される（§18）', async () => {
    await prisma.product.upsert({
      where: { organizationId_code: { organizationId: ids.org, code: 'WT-SOLAR' } },
      update: {},
      create: { organizationId: ids.org, code: 'WT-SOLAR', name: '太陽光', category: 'SOLAR', quantityUnit: 'AMOUNT', isUpsell: true },
    });
    await prisma.upsellStatus.upsert({
      where: { organizationId_code: { organizationId: ids.org, code: 'NEW' } },
      update: {},
      create: { organizationId: ids.org, code: 'NEW', label: '未対応', funnelStage: 'TARGET' },
    });

    const customer = await createCustomer(hq, { name: 'アップセル対象顧客', agencyId: ids.agencyA });
    await createContract(hq, {
      customerId: customer.id,
      productId: ids.product,
      contractWatt: 3000,
      statusId: ids.statusActive,
      contractedAt: CONTRACTED_AT,
    });

    const leads = await prisma.upsellLead.findMany({ where: { customerId: customer.id } });
    expect(leads).toHaveLength(1);
  });

  it('代理店ユーザーは他代理店の顧客に契約を作れない', async () => {
    await expect(
      createContract(agencyA, {
        customerId: ids.customerB,
        productId: ids.product,
        contractWatt: 1000,
        statusId: ids.statusActive,
        contractedAt: CONTRACTED_AT,
      }),
    ).rejects.toThrow('顧客が見つかりません');
  });

  it('契約番号が重複する登録は拒否される（CSV 二重取込の最終防波堤）', async () => {
    const customer = await createCustomer(hq, { name: '重複検証顧客', agencyId: ids.agencyA });
    const number = `WT-DUP-${Date.now()}`;
    await createContract(hq, { customerId: customer.id, productId: ids.product, contractNumber: number, contractWatt: 1000, statusId: ids.statusActive, contractedAt: CONTRACTED_AT });
    await expect(
      createContract(hq, { customerId: customer.id, productId: ids.product, contractNumber: number, contractWatt: 1000, statusId: ids.statusActive, contractedAt: CONTRACTED_AT }),
    ).rejects.toThrow('既に登録されています');
  });

  it('ステータス変更だけでは金額を再計算しない（スナップショット保護）', async () => {
    const customer = await createCustomer(hq, { name: 'ステータス変更顧客', agencyId: ids.agencyA });
    const contract = await createContract(hq, {
      customerId: customer.id, productId: ids.product, contractWatt: 5000, statusId: ids.statusActive, contractedAt: CONTRACTED_AT,
    });

    // 単価マスタを改定してからステータスだけ変更する
    await prisma.agencyUnitPrice.create({
      data: { agencyId: ids.agencyA, productId: ids.product, unitType: 'PER_WATT', unitPrice: new Prisma.Decimal(130), effectiveFrom: new Date(2026, 0, 1), note: 'テスト改定' },
    });

    const result = await updateContract(hq, contract.id, { statusId: ids.statusCancelled });
    expect(result?.repriced).toBe(false);
    expect(toNumber(result?.after.agencyPayout ?? 0)).toBe(500_000);

    // 明示的な再適用でのみ金額が動く
    const repriced = await repriceContract(hq, contract.id, 'テスト再適用');
    expect(toNumber(repriced?.agencyUnitPrice ?? 0)).toBe(130);
    expect(toNumber(repriced?.agencyPayout ?? 0)).toBe(650_000);

    // 履歴は 2 件（作成時 + 再適用）になる
    const snapshots = await prisma.contractPricingSnapshot.count({ where: { contractId: contract.id } });
    expect(snapshots).toBe(2);

    await prisma.agencyUnitPrice.deleteMany({ where: { agencyId: ids.agencyA, note: 'テスト改定' } });
  });
});

describe('キャンセルと集計除外', () => {
  it('キャンセルすると有効売上・支払・粗利から除外される', async () => {
    const customer = await createCustomer(hq, { name: 'キャンセル検証顧客', agencyId: ids.agencyB });
    const contract = await createContract(hq, {
      customerId: customer.id, productId: ids.product, contractWatt: 8000, statusId: ids.statusActive, contractedAt: CONTRACTED_AT,
    });

    const before = await findContractFacts(hq, {});
    const kpiBefore = aggregateSalesKpi(before.map(toFact));

    const cancelled = await cancelContract(hq, contract.id, 'テスト解約');
    expect(cancelled?.cancelledAt).not.toBeNull();

    const after = await findContractFacts(hq, {});
    const kpiAfter = aggregateSalesKpi(after.map(toFact));

    // 総件数は変わらず、有効件数・売上のみ減る
    expect(kpiAfter.totalContracts).toBe(kpiBefore.totalContracts);
    expect(kpiAfter.activeContracts).toBe(kpiBefore.activeContracts - 1);
    expect(kpiBefore.hqRevenue - kpiAfter.hqRevenue).toBe(8000 * 150);
    expect(kpiAfter.cancelledContracts).toBeGreaterThan(0);

    const log = await prisma.auditLog.findFirst({ where: { entity: 'contract', entityId: contract.id, action: 'contract.cancel' } });
    expect(log).not.toBeNull();
  });
});

describe('代理店マスタと単価', () => {
  it('代理店を作成でき、コード重複は拒否される', async () => {
    const code = `WT-NEW-${Date.now()}`;
    const agency = await createAgency(hq, { code, name: '新規代理店', status: 'ACTIVE' });
    expect(agency.code).toBe(code);
    await expect(createAgency(hq, { code, name: '重複代理店', status: 'ACTIVE' })).rejects.toThrow('既に使用されています');

    const log = await prisma.auditLog.findFirst({ where: { entity: 'agency', entityId: agency.id, action: 'agency.create' } });
    expect(log).not.toBeNull();
  });

  it('代理店更新は監査ログに変更前後を残す', async () => {
    const agency = await createAgency(hq, { code: `WT-UPD-${Date.now()}`, name: '更新前', status: 'ACTIVE' });
    await updateAgency(hq, agency.id, { name: '更新後', status: 'SUSPENDED' });
    const log = await prisma.auditLog.findFirst({
      where: { entity: 'agency', entityId: agency.id, action: 'agency.update' },
      orderBy: { createdAt: 'desc' },
    });
    expect((log?.before as Record<string, unknown>).name).toBe('更新前');
    expect((log?.after as Record<string, unknown>).status).toBe('SUSPENDED');
  });

  it('単価追加時、期間が重なる現行単価が自動的に前日で締められる', async () => {
    const agency = await createAgency(hq, { code: `WT-PRICE-${Date.now()}`, name: '単価検証代理店', status: 'ACTIVE' });
    const first = await addAgencyUnitPrice(hq, {
      agencyId: agency.id, productId: ids.product, unitType: 'PER_WATT', unitPrice: 100, effectiveFrom: new Date(2026, 0, 1),
    });
    expect(first.effectiveTo).toBeNull();

    await addAgencyUnitPrice(hq, {
      agencyId: agency.id, productId: ids.product, unitType: 'PER_WATT', unitPrice: 110, effectiveFrom: new Date(2026, 10, 1),
    });

    const closed = await prisma.agencyUnitPrice.findUniqueOrThrow({ where: { id: first.id } });
    expect(closed.effectiveTo?.toISOString().slice(0, 10)).toBe('2026-10-31');
  });

  it('本部スタッフ（pricing:write なし）は Server Action 層で拒否される想定', async () => {
    // サービス層は permission を見ないため、runAction 側の宣言が唯一の防御になる。
    // ここではロールのパーミッション定義が正しいことを確認する。
    const { can } = await import('@/server/authz/context');
    expect(can(hqStaff, 'pricing:write')).toBe(false);
    expect(can(agencyA, 'contract:write')).toBe(false);
    expect(can(hq, 'pricing:write')).toBe(true);
  });
});

function toFact(f: {
  status: { isCancelled: boolean; isDefect: boolean };
  activatedAt: Date | null;
  contractWatt: unknown;
  hqRevenue: unknown;
  agencyPayout: unknown;
  hqGrossProfit: unknown;
}) {
  return {
    isCancelled: f.status.isCancelled,
    isDefect: f.status.isDefect,
    isActivated: f.activatedAt !== null,
    watt: toNumber(f.contractWatt as never),
    hqRevenue: toNumber(f.hqRevenue as never),
    agencyPayout: toNumber(f.agencyPayout as never),
    hqGrossProfit: toNumber(f.hqGrossProfit as never),
  };
}
