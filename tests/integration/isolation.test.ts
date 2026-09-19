import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { findCustomerById, listCustomers } from '@/server/repositories/customer.repo';
import { findContractById, listContracts, findContractFacts } from '@/server/repositories/contract.repo';
import { findAgencyById, listAgencies } from '@/server/repositories/agency.repo';
import { getContractList, getContractDetail } from '@/server/services/contracts';
import { HQ_FINANCIAL_FIELDS } from '@/server/authz/mask';
import { priceContract } from '@/server/services/pricing/snapshot';
import { aggregateSalesKpi } from '@/server/services/kpi';
import { toNumber } from '@/lib/money';

/**
 * 実 DB に対する統合テスト（§4 / §35）。
 * TEST_DATABASE_URL（既定 virtue_test）へスキーマを適用し、専用データで検証する。
 */

const ids = {
  org: 'test-org',
  agencyA: 'test-agency-a',
  agencyB: 'test-agency-b',
  product: 'test-product-elec',
  statusActive: 'test-status-active',
  statusCancelled: 'test-status-cancelled',
  customerA: 'test-customer-a',
  customerB: 'test-customer-b',
  contractA: 'test-contract-a',
  contractB: 'test-contract-b',
  contractCancelled: 'test-contract-cancelled',
};

function ctx(role: AccessContext['role'], agencyId: string | null): AccessContext {
  return { userId: `u-${role}`, role, organizationId: ids.org, agencyId, email: 't@example.jp', name: 'テスト' };
}

const hq = ctx('HQ_ADMIN', null);
const userA = ctx('AGENCY_ADMIN', ids.agencyA);
const userB = ctx('AGENCY_ADMIN', ids.agencyB);

const CONTRACTED_AT = new Date(2026, 6, 15);

async function seedFixture() {
  await prisma.organization.upsert({
    where: { id: ids.org },
    update: {},
    create: { id: ids.org, code: 'TESTORG', name: 'テスト組織' },
  });

  for (const [id, code, name] of [
    [ids.agencyA, 'T-A', 'テスト代理店A'],
    [ids.agencyB, 'T-B', 'テスト代理店B'],
  ] as const) {
    await prisma.agency.upsert({
      where: { id },
      update: {},
      create: { id, organizationId: ids.org, code, name },
    });
  }

  await prisma.product.upsert({
    where: { id: ids.product },
    update: {},
    create: { id: ids.product, organizationId: ids.org, code: 'T-ELEC', name: '電力', category: 'ELECTRICITY', quantityUnit: 'WATT' },
  });

  await prisma.contractStatus.upsert({
    where: { id: ids.statusActive },
    update: {},
    create: { id: ids.statusActive, organizationId: ids.org, code: 'T-ACTIVE', label: '開通済', isActiveContract: true },
  });
  await prisma.contractStatus.upsert({
    where: { id: ids.statusCancelled },
    update: {},
    create: { id: ids.statusCancelled, organizationId: ids.org, code: 'T-CANCELLED', label: 'キャンセル', isActiveContract: false, isCancelled: true },
  });

  // 単価マスタ: 本部受取 150 円/W、代理店Aへ 100 円/W（2026-01-01〜）
  await prisma.pricingRule.deleteMany({ where: { organizationId: ids.org } });
  await prisma.pricingRule.create({
    data: {
      id: 'test-rule-hq',
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
      id: 'test-agency-price-a',
      agencyId: ids.agencyA,
      productId: ids.product,
      unitType: 'PER_WATT',
      unitPrice: new Prisma.Decimal(100),
      effectiveFrom: new Date(2026, 0, 1),
    },
  });

  for (const [id, agencyId, name] of [
    [ids.customerA, ids.agencyA, '代理店Aの顧客'],
    [ids.customerB, ids.agencyB, '代理店Bの顧客'],
  ] as const) {
    await prisma.customer.upsert({
      where: { id },
      update: {},
      create: { id, organizationId: ids.org, agencyId, name, phone: '09000000000', phoneNormalized: '09000000000' },
    });
  }

  const contracts = [
    { id: ids.contractA, agencyId: ids.agencyA, customerId: ids.customerA, number: 'T-A-001', statusId: ids.statusActive, watt: 5000, agencyUnit: 100 },
    { id: ids.contractB, agencyId: ids.agencyB, customerId: ids.customerB, number: 'T-B-001', statusId: ids.statusActive, watt: 4000, agencyUnit: 90 },
    { id: ids.contractCancelled, agencyId: ids.agencyA, customerId: ids.customerA, number: 'T-A-002', statusId: ids.statusCancelled, watt: 9000, agencyUnit: 100 },
  ];

  for (const c of contracts) {
    const hqRevenue = c.watt * 150;
    const agencyPayout = c.watt * c.agencyUnit;
    const grossProfit = hqRevenue - agencyPayout;
    await prisma.contract.upsert({
      where: { id: c.id },
      update: {},
      create: {
        id: c.id,
        organizationId: ids.org,
        agencyId: c.agencyId,
        customerId: c.customerId,
        productId: ids.product,
        contractNumber: c.number,
        statusId: c.statusId,
        quantity: new Prisma.Decimal(c.watt),
        contractWatt: new Prisma.Decimal(c.watt),
        contractedAt: CONTRACTED_AT,
        hqUnitPrice: new Prisma.Decimal(150),
        agencyUnitPrice: new Prisma.Decimal(c.agencyUnit),
        hqRevenue: new Prisma.Decimal(hqRevenue),
        agencyPayout: new Prisma.Decimal(agencyPayout),
        hqGrossProfit: new Prisma.Decimal(grossProfit),
        grossMargin: new Prisma.Decimal(grossProfit / hqRevenue),
        pricedAt: CONTRACTED_AT,
      },
    });
  }
}

beforeAll(async () => {
  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
  });
  await seedFixture();
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('§35 代理店Aユーザー → 代理店Bのデータを取得できない', () => {
  it('顧客一覧に他代理店の顧客が現れない', async () => {
    const result = await listCustomers(userA);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((c) => c.agencyId === ids.agencyA)).toBe(true);
    expect(result.items.some((c) => c.id === ids.customerB)).toBe(false);
  });

  it('ID 直打ちでも他代理店の顧客詳細は取得できない（IDOR 対策）', async () => {
    expect(await findCustomerById(userA, ids.customerB)).toBeNull();
    expect(await findCustomerById(userB, ids.customerA)).toBeNull();
    // 自社の顧客は取得できる
    expect(await findCustomerById(userA, ids.customerA)).not.toBeNull();
    // 本部は両方取得できる
    expect(await findCustomerById(hq, ids.customerB)).not.toBeNull();
  });

  it('契約一覧・契約詳細も同様に分離される', async () => {
    const list = await listContracts(userA);
    expect(list.items.every((c) => c.agencyId === ids.agencyA)).toBe(true);
    expect(await findContractById(userA, ids.contractB)).toBeNull();
    expect(await findContractById(userA, ids.contractA)).not.toBeNull();
  });

  it('代理店マスタは自社 1 社しか見えない', async () => {
    const agencies = await listAgencies(userA);
    expect(agencies).toHaveLength(1);
    expect(agencies[0]?.id).toBe(ids.agencyA);
    expect(await findAgencyById(userA, ids.agencyB)).toBeNull();
  });

  it('集計クエリにもスコープが適用される（他代理店の数字が混ざらない）', async () => {
    const facts = await findContractFacts(userA);
    expect(facts.every((f) => f.agencyId === ids.agencyA)).toBe(true);
    expect(facts.some((f) => f.id === ids.contractB)).toBe(false);
  });
});

describe('§35 代理店ユーザー → VIRTUE粗利を取得できない', () => {
  it('契約一覧 DTO に本部金額のキーが存在しない', async () => {
    const result = await getContractList(userA);
    expect(result.items.length).toBeGreaterThan(0);
    for (const item of result.items) {
      for (const field of HQ_FINANCIAL_FIELDS) {
        expect(field in item).toBe(false);
      }
      // 自社の支払予定額は見える
      expect(typeof item.agencyPayout).toBe('number');
    }
  });

  it('契約詳細でも本部金額とスナップショット履歴を返さない', async () => {
    const detail = await getContractDetail(userA, ids.contractA);
    expect(detail).not.toBeNull();
    expect('hqRevenue' in (detail?.amounts ?? {})).toBe(false);
    expect('hqGrossProfit' in (detail?.amounts ?? {})).toBe(false);
    expect(detail?.pricingSnapshots).toEqual([]);

    // 本部には返る
    const hqDetail = await getContractDetail(hq, ids.contractA);
    expect(hqDetail?.amounts.hqGrossProfit).toBe(250_000);
  });
});

describe('§35 単価変更 → 過去契約の粗利が変わらない', () => {
  it('代理店単価を改定しても、契約行のスナップショットは変化しない', async () => {
    const before = await prisma.contract.findUniqueOrThrow({ where: { id: ids.contractA } });
    expect(toNumber(before.hqGrossProfit)).toBe(250_000);

    // 2026-08-01 から代理店単価を 100 → 130 円/W へ改定
    await prisma.agencyUnitPrice.update({
      where: { id: 'test-agency-price-a' },
      data: { effectiveTo: new Date(2026, 6, 31) },
    });
    await prisma.agencyUnitPrice.create({
      data: {
        id: 'test-agency-price-a2',
        agencyId: ids.agencyA,
        productId: ids.product,
        unitType: 'PER_WATT',
        unitPrice: new Prisma.Decimal(130),
        effectiveFrom: new Date(2026, 7, 1),
      },
    });

    const after = await prisma.contract.findUniqueOrThrow({ where: { id: ids.contractA } });
    expect(toNumber(after.hqGrossProfit)).toBe(250_000);
    expect(toNumber(after.agencyUnitPrice)).toBe(100);
    expect(toNumber(after.agencyPayout)).toBe(500_000);
  });

  it('契約日（基準日）に応じて適用される単価が切り替わる', async () => {
    const july = await priceContract({
      organizationId: ids.org,
      agencyId: ids.agencyA,
      productId: ids.product,
      quantity: 5000,
      basisDate: new Date(2026, 6, 15),
    });
    expect(july.agencyUnitPrice).toBe(100);
    expect(july.hqGrossProfit).toBe(250_000);

    const august = await priceContract({
      organizationId: ids.org,
      agencyId: ids.agencyA,
      productId: ids.product,
      quantity: 5000,
      basisDate: new Date(2026, 7, 15),
    });
    expect(august.agencyUnitPrice).toBe(130);
    expect(august.hqRevenue).toBe(750_000);
    expect(august.agencyPayout).toBe(650_000);
    expect(august.hqGrossProfit).toBe(100_000);
  });
});

describe('§35 キャンセル契約は有効売上・支払集計から除外される', () => {
  it('DB から取得した契約でもキャンセル分が集計されない', async () => {
    const facts = await findContractFacts(hq, {});
    const kpi = aggregateSalesKpi(
      facts.map((f) => ({
        isCancelled: f.status.isCancelled,
        isDefect: f.status.isDefect,
        isActivated: f.activatedAt !== null,
        watt: toNumber(f.contractWatt),
        hqRevenue: toNumber(f.hqRevenue),
        agencyPayout: toNumber(f.agencyPayout),
        hqGrossProfit: toNumber(f.hqGrossProfit),
      })),
    );

    // 有効: A 5,000W(750,000) + B 4,000W(600,000)。キャンセル 9,000W(1,350,000) は除外。
    expect(kpi.totalContracts).toBe(3);
    expect(kpi.activeContracts).toBe(2);
    expect(kpi.cancelledContracts).toBe(1);
    expect(kpi.totalWatt).toBe(9_000);
    expect(kpi.hqRevenue).toBe(1_350_000);
    expect(kpi.agencyPayout).toBe(500_000 + 360_000);
    expect(kpi.cancellationRate).toBeCloseTo(1 / 3, 6);
  });
});
