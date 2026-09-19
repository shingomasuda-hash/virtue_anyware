import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { createCustomer } from '@/server/services/customers';
import { createContract, updateContract } from '@/server/services/contract-write';
import { priceContract } from '@/server/services/pricing/snapshot';
import { seedEvergreenConditions, MANAGEMENT_FEE, NO_STATEMENT_FEE } from '../../prisma/seed/evergreen';
import { toNumber } from '@/lib/money';

/**
 * エバーグリーン条件表を実 DB へ投入し、
 * 「明細の使用量 → 季節係数 → 想定使用量 → 階段表 → 代理店手数料 → +10% → 本部受取」
 * の一連の流れが正しく動くことを検証する。
 */

const ids = {
  org: 'eg-org',
  agency: 'eg-agency',
  product: 'eg-product',
  status: 'eg-status',
  user: 'eg-user',
};

const hq: AccessContext = {
  userId: ids.user,
  role: 'HQ_ADMIN',
  organizationId: ids.org,
  agencyId: null,
  email: 'eg@example.jp',
  name: 'エバーグリーン検証',
};

let supplierId = '';
let planId = '';

/** 2026-09 の条件表が適用される契約日 */
const CONTRACTED_AT = new Date(2026, 8, 20);

beforeAll(async () => {
  execSync('npx prisma migrate deploy', { cwd: process.cwd(), stdio: 'ignore' });

  await prisma.organization.upsert({
    where: { id: ids.org },
    update: {},
    create: { id: ids.org, code: 'EGORG', name: 'エバーグリーン検証組織' },
  });
  await prisma.agency.upsert({
    where: { id: ids.agency },
    update: {},
    create: { id: ids.agency, organizationId: ids.org, code: 'EG-A', name: '検証代理店' },
  });
  await prisma.user.upsert({
    where: { id: ids.user },
    update: {},
    create: { id: ids.user, email: 'eg-user@example.jp', name: hq.name, role: 'HQ_ADMIN', organizationId: ids.org },
  });
  await prisma.product.upsert({
    where: { id: ids.product },
    update: {},
    create: { id: ids.product, organizationId: ids.org, code: 'EG-ELEC', name: '電力', category: 'ELECTRICITY', quantityUnit: 'WATT' },
  });
  await prisma.contractStatus.upsert({
    where: { id: ids.status },
    update: {},
    create: { id: ids.status, organizationId: ids.org, code: 'EG-ACTIVE', label: '開通済', isActiveContract: true },
  });

  // 代理店側の 円/W 単価は登録しない（階段表ルールが使われることを確認するため）
  await prisma.agencyUnitPrice.deleteMany({ where: { agencyId: ids.agency } });

  const seeded = await seedEvergreenConditions({
    organizationId: ids.org,
    productId: ids.product,
    createdById: ids.user,
  });
  supplierId = seeded.supplierId;
  planId = seeded.planId;
}, 120_000);

afterAll(async () => {
  await prisma.$disconnect();
});

async function price(params: {
  actualUsageKwh: number | null;
  usageMonth: number | null;
  hasStatement?: boolean;
  isMatchingConfirmed?: boolean;
}) {
  return priceContract({
    organizationId: ids.org,
    agencyId: ids.agency,
    productId: ids.product,
    supplierId,
    planId,
    quantity: 0,
    basisDate: CONTRACTED_AT,
    ...params,
  });
}

describe('条件表マスタが DB から正しく解決される', () => {
  it('季節係数 12 か月・階段表 30 段が登録されている', async () => {
    expect(await prisma.seasonalCoefficient.count({ where: { organizationId: ids.org } })).toBe(12);
    const rule = await prisma.pricingRule.findFirstOrThrow({
      where: { organizationId: ids.org, unitType: 'TIERED_BY_USAGE' },
      include: { _count: { select: { tiers: true } } },
    });
    expect(rule._count.tiers).toBe(30);
  });

  it('但し書き用の固定額ルールが通常の単価解決を邪魔しない', async () => {
    // 明細なし 3,600 円・業務管理費 1,000 円も AGENCY_PAYOUT の FIXED ルールだが、
    // 通常の解決では階段表ルールが選ばれること
    const result = await price({ actualUsageKwh: 500, usageMonth: 6 });
    expect(result.agencyUnitType).toBe('TIERED_BY_USAGE');
    expect(result.hqUnitType).toBe('MARKUP_ON_PAYOUT');
  });
});

describe('使用量 → 季節係数 → 階段表 → +10% の一連の計算', () => {
  it('6月検針 500kWh → 想定582kWh → 代理店45,900円 → 本部50,490円', async () => {
    const result = await price({ actualUsageKwh: 500, usageMonth: 6 });

    expect(result.usage.coefficient).toBe(1.164);
    expect(result.usage.estimatedUsageKwh).toBe(582);
    expect(result.agencyPayout).toBe(45_900);
    expect(result.hqRevenue).toBe(50_490);
    expect(result.hqGrossProfit).toBe(4_590);
    expect(result.grossMargin).toBeCloseTo(0.0909, 4);
  });

  it('同じ使用量でも検針月が変わると手数料が変わる', async () => {
    // 8月は係数 0.867 → 433.5kWh → 400以上450未満 → 32,400円
    const august = await price({ actualUsageKwh: 500, usageMonth: 8 });
    expect(august.usage.estimatedUsageKwh).toBe(433.5);
    expect(august.agencyPayout).toBe(32_400);
    expect(august.hqRevenue).toBe(35_640);

    // 6月は 582kWh → 45,900円
    const june = await price({ actualUsageKwh: 500, usageMonth: 6 });
    expect(june.agencyPayout).toBe(45_900);
  });

  it('50kWh 未満は手数料 0 円', async () => {
    // 1月係数 0.869 → 40 × 0.869 = 34.76kWh
    const result = await price({ actualUsageKwh: 40, usageMonth: 1 });
    expect(result.usage.estimatedUsageKwh).toBe(34.76);
    expect(result.agencyPayout).toBe(0);
    expect(result.hqRevenue).toBe(0);
    expect(result.grossMargin).toBe(0);
  });

  it('1450kWh 以上は上限額で頭打ちになる', async () => {
    const result = await price({ actualUsageKwh: 3000, usageMonth: 6 });
    expect(result.agencyPayout).toBe(126_900);
    expect(result.hqRevenue).toBe(139_590);
  });

  it('適用した階段表の行 ID が算定根拠として返る', async () => {
    const result = await price({ actualUsageKwh: 500, usageMonth: 6 });
    expect(result.agencyTierId).not.toBeNull();

    const tier = await prisma.pricingTier.findUniqueOrThrow({ where: { id: result.agencyTierId ?? '' } });
    expect(toNumber(tier.minValue)).toBe(550);
    expect(toNumber(tier.maxValue ?? 0)).toBe(600);
    expect(toNumber(tier.amount)).toBe(45_900);
  });
});

describe('条件表の但し書き', () => {
  it('明細の写真がない場合は定額 3,600 円になる', async () => {
    const result = await price({ actualUsageKwh: 500, usageMonth: 6, hasStatement: false });
    expect(result.appliedNoStatementFee).toBe(true);
    expect(result.agencyPayout).toBe(NO_STATEMENT_FEE);
    expect(result.hqRevenue).toBe(3_960);
  });

  it('マッチング確認案件は業務管理費 1,000 円が相殺される', async () => {
    const result = await price({ actualUsageKwh: 500, usageMonth: 6, isMatchingConfirmed: true });
    expect(result.deduction).toBe(MANAGEMENT_FEE);
    expect(result.agencyPayout).toBe(44_900);
    // 本部受取は控除前の手数料に 10%
    expect(result.hqRevenue).toBe(50_490);
    expect(result.hqGrossProfit).toBe(5_590);
  });
});

describe('契約への保存とスナップショット', () => {
  it('契約登録時に算定根拠がすべてスナップショット保存される', async () => {
    const customer = await createCustomer(hq, { name: '条件表検証顧客', agencyId: ids.agency });
    const contract = await createContract(hq, {
      customerId: customer.id,
      productId: ids.product,
      supplierId,
      planId,
      contractNumber: `EG-${Date.now()}`,
      contractWatt: 0,
      actualUsageKwh: 500,
      usageMonth: 6,
      statusId: ids.status,
      contractedAt: CONTRACTED_AT,
    });

    expect(toNumber(contract.actualUsageKwh ?? 0)).toBe(500);
    expect(contract.usageMonth).toBe(6);
    expect(toNumber(contract.seasonalCoefficient ?? 0)).toBe(1.164);
    expect(toNumber(contract.estimatedUsageKwh ?? 0)).toBe(582);
    expect(toNumber(contract.agencyPayout)).toBe(45_900);
    expect(toNumber(contract.hqRevenue)).toBe(50_490);

    const snapshot = await prisma.contractPricingSnapshot.findFirstOrThrow({
      where: { contractId: contract.id },
    });
    expect(toNumber(snapshot.actualUsageKwh ?? 0)).toBe(500);
    expect(snapshot.usageMonth).toBe(6);
    expect(toNumber(snapshot.estimatedUsageKwh ?? 0)).toBe(582);
    expect(snapshot.agencyTierId).not.toBeNull();
    expect(snapshot.hqUnitType).toBe('MARKUP_ON_PAYOUT');
  });

  it('使用量を修正すると再計算され、履歴が 2 件になる', async () => {
    const customer = await createCustomer(hq, { name: '使用量修正顧客', agencyId: ids.agency });
    const contract = await createContract(hq, {
      customerId: customer.id,
      productId: ids.product,
      supplierId,
      planId,
      contractWatt: 0,
      actualUsageKwh: 500,
      usageMonth: 6,
      statusId: ids.status,
      contractedAt: CONTRACTED_AT,
    });
    expect(toNumber(contract.agencyPayout)).toBe(45_900);

    // 明細を確認したら 800kWh だった → 800 × 1.164 = 931.2kWh → 900以上950未満 → 77,400円
    const updated = await updateContract(hq, contract.id, { actualUsageKwh: 800 });
    expect(updated?.repriced).toBe(true);
    expect(toNumber(updated?.after.estimatedUsageKwh ?? 0)).toBe(931.2);
    expect(toNumber(updated?.after.agencyPayout ?? 0)).toBe(77_400);
    expect(toNumber(updated?.after.hqRevenue ?? 0)).toBe(85_140);

    expect(await prisma.contractPricingSnapshot.count({ where: { contractId: contract.id } })).toBe(2);
  });

  it('ステータス変更だけでは使用量ベースの金額を動かさない', async () => {
    const customer = await createCustomer(hq, { name: '据え置き検証顧客', agencyId: ids.agency });
    const contract = await createContract(hq, {
      customerId: customer.id,
      productId: ids.product,
      supplierId,
      planId,
      contractWatt: 0,
      actualUsageKwh: 500,
      usageMonth: 6,
      statusId: ids.status,
      contractedAt: CONTRACTED_AT,
    });

    const updated = await updateContract(hq, contract.id, { campaign: '秋の切替' });
    expect(updated?.repriced).toBe(false);
    expect(toNumber(updated?.after.agencyPayout ?? 0)).toBe(45_900);
  });
});

describe('汎用の 円/W 単価と供給元固有の階段表が併存する場合', () => {
  it('供給元・プランまで一致する階段表が、汎用の 円/W 単価より優先される', async () => {
    // 代理店に汎用（供給元指定なし）の 円/W 単価を登録する
    await prisma.agencyUnitPrice.create({
      data: {
        agencyId: ids.agency,
        productId: ids.product,
        unitType: 'PER_WATT',
        unitPrice: 100,
        effectiveFrom: new Date(2026, 0, 1),
        note: '汎用単価',
      },
    });

    try {
      // エバーグリーン（供給元指定あり）の契約は階段表が使われる
      const evergreen = await price({ actualUsageKwh: 500, usageMonth: 6 });
      expect(evergreen.agencyUnitType).toBe('TIERED_BY_USAGE');
      expect(evergreen.agencyPayout).toBe(45_900);

      // 供給元を指定しない契約では汎用の 円/W 単価が使われる
      const generic = await priceContract({
        organizationId: ids.org,
        agencyId: ids.agency,
        productId: ids.product,
        supplierId: null,
        planId: null,
        quantity: 5000,
        basisDate: CONTRACTED_AT,
      });
      expect(generic.agencyUnitType).toBe('PER_WATT');
      expect(generic.agencyPayout).toBe(500_000);
    } finally {
      await prisma.agencyUnitPrice.deleteMany({ where: { agencyId: ids.agency, note: '汎用単価' } });
    }
  });
});
