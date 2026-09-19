import { PricingSide, type PriceUnitType } from '@/generated/prisma';
import { prisma } from '@/server/db';
import { toNumber } from '@/lib/money';
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
      AND: [
        { OR: [{ agencyId: lookup.agencyId ?? null }, { agencyId: null }] },
        { OR: [{ productId: lookup.productId ?? null }, { productId: null }] },
        { OR: [{ supplierId: lookup.supplierId ?? null }, { supplierId: null }] },
        { OR: [{ planId: lookup.planId ?? null }, { planId: null }] },
      ],
      effectiveFrom: { lte: lookup.basisDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: lookup.basisDate } }],
    },
  });

  const picked = pickMostSpecific(rules);
  if (!picked) return null;
  return {
    unitType: picked.unitType,
    unitPrice: toNumber(picked.unitPrice as never),
    rate: picked.rate === null || picked.rate === undefined ? null : toNumber(picked.rate as never),
    sourceId: picked.id,
  };
}

/**
 * 代理店支払単価の解決。
 * 代理店マスタ側の単価履歴（agency_unit_prices, §5）を優先し、
 * 無ければ pricing_rules(side=AGENCY_PAYOUT) にフォールバックする。
 */
export async function resolveAgencyPayoutPrice(lookup: PriceLookup): Promise<ResolvedPrice | null> {
  if (lookup.agencyId) {
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
    if (picked) {
      return {
        unitType: picked.unitType,
        unitPrice: toNumber(picked.unitPrice),
        rate: null,
        sourceId: picked.id,
      };
    }
  }
  return resolvePricingRule(PricingSide.AGENCY_PAYOUT, lookup);
}

export async function resolveHqReceivePrice(lookup: PriceLookup): Promise<ResolvedPrice | null> {
  return resolvePricingRule(PricingSide.HQ_RECEIVE, lookup);
}
