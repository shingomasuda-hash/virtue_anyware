import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { orgScope } from '@/server/authz/scope';
import { toNumber } from '@/lib/money';
import { validateTiers, type PriceTier, type TierValidationIssue } from './tiers';
import { FEE_POLICY_CODES } from './masters';

export interface PricingRuleOverview {
  id: string;
  side: 'HQ_RECEIVE' | 'AGENCY_PAYOUT';
  unitType: string;
  unitPrice: number;
  rate: number | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  priority: number;
  note: string | null;
  agencyName: string | null;
  productName: string | null;
  supplierName: string | null;
  planName: string | null;
  tiers: PriceTier[];
  tierIssues: TierValidationIssue[];
  isFeePolicy: boolean;
}

export interface SeasonalCoefficientGroup {
  supplierName: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  byMonth: Record<number, number>;
}

/** 単価マスタの一覧。階段表と季節係数もまとめて返す。 */
export async function getPricingOverview(ctx: AccessContext) {
  const scope = orgScope(ctx);
  const where = scope.organizationId ? { organizationId: scope.organizationId } : {};

  const [rules, coefficients] = await Promise.all([
    prisma.pricingRule.findMany({
      where,
      orderBy: [{ side: 'asc' }, { effectiveFrom: 'desc' }, { priority: 'desc' }],
      include: {
        agency: { select: { name: true } },
        product: { select: { name: true } },
        supplier: { select: { name: true } },
        plan: { select: { name: true } },
        tiers: { orderBy: [{ sortOrder: 'asc' }, { minValue: 'asc' }] },
      },
    }),
    prisma.seasonalCoefficient.findMany({
      where,
      orderBy: [{ effectiveFrom: 'desc' }, { month: 'asc' }],
      include: { supplier: { select: { name: true } } },
    }),
  ]);

  const feePolicyNotes: string[] = [FEE_POLICY_CODES.NO_STATEMENT, FEE_POLICY_CODES.MANAGEMENT];

  const ruleRows: PricingRuleOverview[] = rules.map((rule) => {
    const tiers: PriceTier[] = rule.tiers.map((t) => ({
      id: t.id,
      minValue: toNumber(t.minValue),
      maxValue: t.maxValue === null ? null : toNumber(t.maxValue),
      amount: toNumber(t.amount),
    }));
    return {
      id: rule.id,
      side: rule.side,
      unitType: rule.unitType,
      unitPrice: toNumber(rule.unitPrice),
      rate: rule.rate === null ? null : toNumber(rule.rate),
      effectiveFrom: rule.effectiveFrom,
      effectiveTo: rule.effectiveTo,
      priority: rule.priority,
      note: rule.note,
      agencyName: rule.agency?.name ?? null,
      productName: rule.product?.name ?? null,
      supplierName: rule.supplier?.name ?? null,
      planName: rule.plan?.name ?? null,
      tiers,
      // 階段表の隙間・重複はここで検出して画面に出す
      tierIssues: tiers.length > 0 ? validateTiers(tiers) : [],
      isFeePolicy: rule.note !== null && feePolicyNotes.includes(rule.note),
    };
  });

  // 季節係数は「供給元 × 適用開始日」でまとめて 12 か月の表にする
  const groups = new Map<string, SeasonalCoefficientGroup>();
  for (const row of coefficients) {
    const key = `${row.supplierId ?? 'common'}:${row.effectiveFrom.toISOString()}`;
    const group = groups.get(key) ?? {
      supplierName: row.supplier?.name ?? null,
      effectiveFrom: row.effectiveFrom,
      effectiveTo: row.effectiveTo,
      byMonth: {},
    };
    group.byMonth[row.month] = toNumber(row.coefficient);
    groups.set(key, group);
  }

  return { rules: ruleRows, seasonalGroups: [...groups.values()] };
}

/** 代理店単価（agency_unit_prices）の一覧。 */
export async function getAgencyUnitPrices(ctx: AccessContext) {
  const scope = orgScope(ctx);
  return prisma.agencyUnitPrice.findMany({
    where: scope.organizationId ? { agency: { organizationId: scope.organizationId } } : {},
    orderBy: [{ effectiveFrom: 'desc' }],
    include: { agency: { select: { name: true, code: true } }, product: { select: { name: true } } },
  });
}
