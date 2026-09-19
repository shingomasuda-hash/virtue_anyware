import { prisma } from '@/server/db';
import { toNumber } from '@/lib/money';
import type { PriceTier } from './tiers';

/**
 * 季節係数を読み込む（月 → 係数）。
 * 適用期間つきなので、契約日時点で有効だった係数が使われる。
 */
export async function loadSeasonalCoefficients(
  organizationId: string,
  supplierId: string | null,
  basisDate: Date,
): Promise<Record<number, number>> {
  const rows = await prisma.seasonalCoefficient.findMany({
    where: {
      organizationId,
      OR: [{ supplierId }, { supplierId: null }],
      effectiveFrom: { lte: basisDate },
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: basisDate } }] }],
    },
    // 供給元が明示された係数を、全社共通より優先する
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  });

  const map: Record<number, number> = {};
  const seenSpecific = new Set<number>();
  for (const row of rows) {
    const isSpecific = row.supplierId !== null;
    if (map[row.month] !== undefined && (!isSpecific || seenSpecific.has(row.month))) continue;
    map[row.month] = toNumber(row.coefficient);
    if (isSpecific) seenSpecific.add(row.month);
  }
  return map;
}

/** 階段表を読み込む。 */
export async function loadTiers(pricingRuleId: string): Promise<PriceTier[]> {
  const rows = await prisma.pricingTier.findMany({
    where: { pricingRuleId },
    orderBy: [{ sortOrder: 'asc' }, { minValue: 'asc' }],
  });
  return rows.map((row) => ({
    id: row.id,
    minValue: toNumber(row.minValue),
    maxValue: row.maxValue === null ? null : toNumber(row.maxValue),
    amount: toNumber(row.amount),
  }));
}

/**
 * 手数料まわりの固定額ポリシー。
 * 金額はコードに書かず、`pricing_rules` の note ではなく専用の設定として持たせる。
 * 現状は供給元ごとの `FIXED` ルールとして表現している。
 */
export interface FeePolicy {
  /** 明細の写真が無い場合の定額手数料（円/地点、税抜） */
  noStatementFee: number;
  /** マッチング確認案件ごとの業務管理費（円/地点、税抜） */
  managementFee: number;
}

export const FEE_POLICY_CODES = {
  NO_STATEMENT: 'FEE_NO_STATEMENT',
  MANAGEMENT: 'FEE_MANAGEMENT',
} as const;

/**
 * 条件表の但し書き（明細なし / 業務管理費）を単価マスタから読む。
 * `pricing_rules.note` に上記コードを入れた FIXED ルールとして登録する。
 */
export async function loadFeePolicy(
  organizationId: string,
  supplierId: string | null,
  basisDate: Date,
): Promise<FeePolicy> {
  const rows = await prisma.pricingRule.findMany({
    where: {
      organizationId,
      unitType: 'FIXED',
      note: { in: [FEE_POLICY_CODES.NO_STATEMENT, FEE_POLICY_CODES.MANAGEMENT] },
      OR: [{ supplierId }, { supplierId: null }],
      effectiveFrom: { lte: basisDate },
      AND: [{ OR: [{ effectiveTo: null }, { effectiveTo: { gte: basisDate } }] }],
    },
    orderBy: [{ effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  });

  const pick = (code: string): number => {
    const specific = rows.find((r) => r.note === code && r.supplierId === supplierId);
    const generic = rows.find((r) => r.note === code);
    const chosen = specific ?? generic;
    return chosen ? toNumber(chosen.unitPrice) : 0;
  };

  return {
    noStatementFee: pick(FEE_POLICY_CODES.NO_STATEMENT),
    managementFee: pick(FEE_POLICY_CODES.MANAGEMENT),
  };
}
