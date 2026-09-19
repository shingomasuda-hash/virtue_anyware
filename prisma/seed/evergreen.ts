import { Prisma } from '../../src/generated/prisma/index.js';
import { prisma } from './client.js';
import { FEE_POLICY_CODES } from '../../src/server/services/pricing/masters.js';

/**
 * エバーグリーン 条件表（対象期間: 2026-09-01〜2026-09-30）のマスタ投入。
 *
 * 条件表は毎月通知され、「2 回以上通知された場合は改定日の新しい通知書が優先」される。
 * そのため適用期間つきで登録し、改定のたびに新しい期間の行を足す運用にする。
 * 過去契約の金額は契約行のスナップショットで保護されるため、改定しても遡って変わらない。
 */

export const EVERGREEN_SUPPLIER_CODE = 'EVERGREEN';

/** 季節係数表（%）。使用量の多い月ほど係数が小さく、平準化される。 */
export const SEASONAL_COEFFICIENTS: Readonly<Record<number, number>> = {
  1: 0.869,
  2: 0.905,
  3: 0.964,
  4: 1.066,
  5: 1.142,
  6: 1.164,
  7: 0.974,
  8: 0.867,
  9: 0.912,
  10: 1.053,
  11: 1.122,
  12: 1.091,
};

/**
 * 成約事務手数料対照表（MPプラン）。
 * 「想定使用量(kWh) が min 以上 max 未満 → amount 円（税抜）」。
 */
export const MP_PLAN_TIERS: ReadonlyArray<{ min: number; max: number | null; amount: number }> = [
  { min: 0, max: 50, amount: 0 },
  { min: 50, max: 100, amount: 3_600 },
  { min: 100, max: 150, amount: 7_200 },
  { min: 150, max: 200, amount: 11_700 },
  { min: 200, max: 250, amount: 16_200 },
  { min: 250, max: 300, amount: 20_700 },
  { min: 300, max: 350, amount: 25_200 },
  { min: 350, max: 400, amount: 29_700 },
  { min: 400, max: 450, amount: 32_400 },
  { min: 450, max: 500, amount: 36_900 },
  { min: 500, max: 550, amount: 41_400 },
  { min: 550, max: 600, amount: 45_900 },
  { min: 600, max: 650, amount: 50_400 },
  { min: 650, max: 700, amount: 54_900 },
  { min: 700, max: 750, amount: 59_400 },
  { min: 750, max: 800, amount: 63_900 },
  { min: 800, max: 850, amount: 68_400 },
  { min: 850, max: 900, amount: 72_900 },
  { min: 900, max: 950, amount: 77_400 },
  { min: 950, max: 1000, amount: 81_900 },
  { min: 1000, max: 1050, amount: 86_400 },
  { min: 1050, max: 1100, amount: 90_900 },
  { min: 1100, max: 1150, amount: 95_400 },
  { min: 1150, max: 1200, amount: 99_900 },
  { min: 1200, max: 1250, amount: 104_400 },
  { min: 1250, max: 1300, amount: 108_900 },
  { min: 1300, max: 1350, amount: 113_400 },
  { min: 1350, max: 1400, amount: 117_900 },
  { min: 1400, max: 1450, amount: 122_400 },
  { min: 1450, max: null, amount: 126_900 },
];

/** 明細の写真がない場合の定額手数料（円/地点、税抜）。 */
export const NO_STATEMENT_FEE = 3_600;
/** マッチング確認案件ごとの業務管理費（円/地点、税抜）。手数料と相殺する。 */
export const MANAGEMENT_FEE = 1_000;
/** VIRTUE の受取単価は代理店 fee に +10%。 */
export const HQ_MARKUP_RATE = 0.1;

/** 条件表の適用期間（通知書の対象期間）。 */
export const EFFECTIVE_FROM = new Date(2026, 8, 1); // 2026-09-01

export async function seedEvergreenConditions(params: {
  organizationId: string;
  productId: string;
  createdById: string | null;
}) {
  const { organizationId, productId, createdById } = params;

  const supplier = await prisma.supplier.upsert({
    where: { organizationId_code: { organizationId, code: EVERGREEN_SUPPLIER_CODE } },
    update: { name: 'エバーグリーン' },
    create: { organizationId, code: EVERGREEN_SUPPLIER_CODE, name: 'エバーグリーン' },
  });

  const plan = await prisma.plan.upsert({
    where: { supplierId_code: { supplierId: supplier.id, code: 'MP' } },
    update: { name: 'MPプラン' },
    create: { supplierId: supplier.id, productId, code: 'MP', name: 'MPプラン' },
  });

  // ── 季節係数 ──
  await prisma.seasonalCoefficient.deleteMany({ where: { organizationId, supplierId: supplier.id } });
  await prisma.seasonalCoefficient.createMany({
    data: Object.entries(SEASONAL_COEFFICIENTS).map(([month, coefficient]) => ({
      organizationId,
      supplierId: supplier.id,
      productId,
      month: Number(month),
      coefficient: new Prisma.Decimal(coefficient),
      effectiveFrom: EFFECTIVE_FROM,
      note: '2026年9月度 条件表',
    })),
  });

  // ── 代理店への成約事務手数料（階段表）──
  await prisma.pricingRule.deleteMany({
    where: { organizationId, supplierId: supplier.id },
  });

  const agencyRule = await prisma.pricingRule.create({
    data: {
      organizationId,
      side: 'AGENCY_PAYOUT',
      productId,
      supplierId: supplier.id,
      planId: plan.id,
      unitType: 'TIERED_BY_USAGE',
      unitPrice: new Prisma.Decimal(0),
      effectiveFrom: EFFECTIVE_FROM,
      priority: 10,
      note: 'エバーグリーン MPプラン 成約事務手数料対照表（2026年9月度）',
      createdById,
    },
  });

  await prisma.pricingTier.createMany({
    data: MP_PLAN_TIERS.map((tier, index) => ({
      pricingRuleId: agencyRule.id,
      minValue: new Prisma.Decimal(tier.min),
      maxValue: tier.max === null ? null : new Prisma.Decimal(tier.max),
      amount: new Prisma.Decimal(tier.amount),
      sortOrder: index,
    })),
  });

  // ── VIRTUE の受取単価 = 代理店 fee + 10% ──
  const hqRule = await prisma.pricingRule.create({
    data: {
      organizationId,
      side: 'HQ_RECEIVE',
      productId,
      supplierId: supplier.id,
      planId: plan.id,
      unitType: 'MARKUP_ON_PAYOUT',
      unitPrice: new Prisma.Decimal(0),
      rate: new Prisma.Decimal(HQ_MARKUP_RATE),
      effectiveFrom: EFFECTIVE_FROM,
      priority: 10,
      note: 'VIRTUE 受取単価（代理店手数料 + 10%）',
      createdById,
    },
  });

  // ── 但し書き（明細なし手数料 / 業務管理費）──
  await prisma.pricingRule.create({
    data: {
      organizationId,
      side: 'AGENCY_PAYOUT',
      supplierId: supplier.id,
      unitType: 'FIXED',
      unitPrice: new Prisma.Decimal(NO_STATEMENT_FEE),
      effectiveFrom: EFFECTIVE_FROM,
      note: FEE_POLICY_CODES.NO_STATEMENT,
      createdById,
    },
  });
  await prisma.pricingRule.create({
    data: {
      organizationId,
      side: 'AGENCY_PAYOUT',
      supplierId: supplier.id,
      unitType: 'FIXED',
      unitPrice: new Prisma.Decimal(MANAGEMENT_FEE),
      effectiveFrom: EFFECTIVE_FROM,
      note: FEE_POLICY_CODES.MANAGEMENT,
      createdById,
    },
  });

  return { supplierId: supplier.id, planId: plan.id, agencyRuleId: agencyRule.id, hqRuleId: hqRule.id };
}
