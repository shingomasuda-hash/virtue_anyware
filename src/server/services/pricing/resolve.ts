import { PricingSide, type PriceUnitType } from '@/generated/prisma';
import { prisma } from '@/server/db';
import { toNumber } from '@/lib/money';
import { FEE_POLICY_CODES, loadTiers } from './masters';
import type { ResolvedPrice } from './calc';

export interface PriceLookup {
  organizationId: string;
  agencyId?: string | null;
  productId?: string | null;
  supplierId?: string | null;
  planId?: string | null;
  /** 適用基準日。契約日（無ければ申込日）を渡す（§8.3）。 */
  basisDate: Date;
}

interface RuleLike {
  id: string;
  agencyId: string | null;
  productId: string | null;
  supplierId: string | null;
  planId: string | null;
  unitType: PriceUnitType;
  unitPrice: unknown;
  rate: unknown;
  priority: number;
  effectiveFrom: Date;
}

/** 一致した非 NULL スコープ数。より具体的なルールを優先するための指標。 */
export function specificityOf(rule: Pick<RuleLike, 'agencyId' | 'productId' | 'supplierId' | 'planId'>): number {
  return (
    (rule.agencyId ? 1 : 0) +
    (rule.productId ? 1 : 0) +
    (rule.supplierId ? 1 : 0) +
    (rule.planId ? 1 : 0)
  );
}

export function pickMostSpecific<T extends RuleLike>(rules: readonly T[]): T | null {
  if (rules.length === 0) return null;
  return [...rules].sort((a, b) => {
    const s = specificityOf(b) - specificityOf(a);
    if (s !== 0) return s;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.effectiveFrom.getTime() - a.effectiveFrom.getTime();
  })[0] as T;
}

/**
 * 単価マスタから最も具体的な 1 件を解決する。
 * コードに単価を直接書かないための唯一の入口（§6）。
 */
export async function resolvePricingRule(
  side: PricingSide,
  lookup: PriceLookup,
): Promise<ResolvedPrice | null> {
  const rules = await prisma.pricingRule.findMany({
    where: {
      organizationId: lookup.organizationId,
      side,
      effectiveFrom: { lte: lookup.basisDate },
      AND: [
        { OR: [{ agencyId: lookup.agencyId ?? null }, { agencyId: null }] },
        { OR: [{ productId: lookup.productId ?? null }, { productId: null }] },
        { OR: [{ supplierId: lookup.supplierId ?? null }, { supplierId: null }] },
        { OR: [{ planId: lookup.planId ?? null }, { planId: null }] },
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: lookup.basisDate } }] },
        // 但し書き用の固定額ルール（明細なし手数料・業務管理費）は通常の単価解決から除外する。
        // `NOT IN` だけでは note が NULL の行まで落ちてしまうため、明示的に NULL を許可する。
        {
          OR: [
            { note: null },
            { NOT: { note: { in: [FEE_POLICY_CODES.NO_STATEMENT, FEE_POLICY_CODES.MANAGEMENT] } } },
          ],
        },
      ],
    },
  });

  const picked = pickMostSpecific(rules);
  if (!picked) return null;
  return {
    unitType: picked.unitType,
    unitPrice: toNumber(picked.unitPrice as never),
    rate: picked.rate === null || picked.rate === undefined ? null : toNumber(picked.rate as never),
    // 階段表方式のときだけ表を読み込む（通常の単価方式では余計なクエリを出さない）
    tiers: picked.unitType === 'TIERED_BY_USAGE' ? await loadTiers(picked.id) : undefined,
    sourceId: picked.id,
    specificity: specificityOf(picked),
  };
}

/**
 * 代理店支払単価の解決。
 *
 * 代理店マスタ側の単価履歴（agency_unit_prices, §5）と
 * 単価ルール（pricing_rules(AGENCY_PAYOUT)）の**より具体的な方**を採用する。
 *
 * `agency_unit_prices` は代理店（＋商材）までしか指定できないため specificity は最大 2。
 * 供給元やプランまで指定された単価ルール（例: エバーグリーン MPプランの階段表）は
 * それより具体的なので優先される。
 *
 * これを「代理店マスタを常に優先」にすると、汎用の 円/W 単価が
 * 供給元固有の階段表を握りつぶし、手数料が 0 円になる事故が起きる。
 */
export async function resolveAgencyPayoutPrice(lookup: PriceLookup): Promise<ResolvedPrice | null> {
  const rulePrice = await resolvePricingRule(PricingSide.AGENCY_PAYOUT, lookup);

  if (!lookup.agencyId) return rulePrice;

  const prices = await prisma.agencyUnitPrice.findMany({
    where: {
      agencyId: lookup.agencyId,
      OR: [{ productId: lookup.productId ?? null }, { productId: null }],
      effectiveFrom: { lte: lookup.basisDate },
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: lookup.basisDate } }] }],
    },
    // 適用開始日が同じ行が複数ある場合は「後から登録されたもの」を採用する。
    // 並び順を固定しないと解決結果が非決定的になる。
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  });
  // 商材が明示されたルールを、全商材共通ルールより優先する
  const picked = prices.find((p) => p.productId === lookup.productId) ?? prices[0];
  if (!picked) return rulePrice;

  const agencyPrice: ResolvedPrice = {
    unitType: picked.unitType,
    unitPrice: toNumber(picked.unitPrice),
    rate: null,
    sourceId: picked.id,
    // 代理店は常に一致。商材が明示されていればもう 1 点。
    specificity: 1 + (picked.productId !== null ? 1 : 0),
  };

  if (rulePrice && (rulePrice.specificity ?? 0) > (agencyPrice.specificity ?? 0)) {
    return rulePrice;
  }
  return agencyPrice;
}

export async function resolveHqReceivePrice(lookup: PriceLookup): Promise<ResolvedPrice | null> {
  return resolvePricingRule(PricingSide.HQ_RECEIVE, lookup);
}
