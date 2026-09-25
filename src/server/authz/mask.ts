import { can, canViewHqFinancials, type AccessContext } from './context';

/** 本部限定の財務フィールド（代理店には返さない）。 */
export const HQ_FINANCIAL_FIELDS = [
  'hqUnitPrice',
  'hqRevenue',
  'hqGrossProfit',
  'grossMargin',
] as const;

export type HqFinancialField = (typeof HQ_FINANCIAL_FIELDS)[number];

export type WithoutHqFinancials<T> = Omit<T, HqFinancialField>;

/**
 * 本部財務フィールドを**オブジェクトから物理的に削除**する。
 * UI で非表示にするのではなく、サーバーの戻り値から消すことが要件（§17 / docs/04_RBAC.md 4.4）。
 */
export function maskHqFinancials<T extends object>(
  ctx: AccessContext,
  record: T,
): T | WithoutHqFinancials<T> {
  if (canViewHqFinancials(ctx)) return record;
  const clone = { ...record } as Record<string, unknown>;
  for (const field of HQ_FINANCIAL_FIELDS) {
    delete clone[field];
  }
  return clone as WithoutHqFinancials<T>;
}

export function maskHqFinancialsList<T extends object>(
  ctx: AccessContext,
  records: readonly T[],
): Array<T | WithoutHqFinancials<T>> {
  if (canViewHqFinancials(ctx)) return [...records];
  return records.map((r) => maskHqFinancials(ctx, r));
}

/**
 * 案件の報酬のうち、本部限定のフィールド（docs/15_DEAL_MANAGEMENT.md 15.5）。
 *
 * 原価・営業利益・控除額・会社残粗利・営業個人のコミッションは代理店へ返さない。
 * 代理店に残すのは**自社の代理店コミッションと支払状況だけ**。
 */
export const DEAL_HQ_FINANCIAL_FIELDS = [
  'equipmentCost',
  'constructionCost',
  'extendedWarrantyCost',
  'otherCost',
  'totalCost',
  'grossProfit',
  'deductionAmount',
  'commissionBase',
  'salesCommissionRate',
  'salesCommission',
  'companyGrossProfit',
] as const;

export type DealHqFinancialField = (typeof DEAL_HQ_FINANCIAL_FIELDS)[number];

export type WithoutDealHqFinancials<T> = Omit<T, DealHqFinancialField>;

/**
 * 報酬の本部限定フィールドをオブジェクトから物理削除する。
 *
 * `deal:compensation` を持たないロールは通常そもそも報酬を取得できないが、
 * 将来「代理店に自社コミッションだけ開示する」要件が来たときに
 * UI での出し分けに頼らないための土台としてここに置く。
 */
export function maskDealFinancials<T extends object>(
  ctx: AccessContext,
  record: T,
): T | WithoutDealHqFinancials<T> {
  if (can(ctx, 'deal:compensation')) return record;
  const clone = { ...record } as Record<string, unknown>;
  for (const field of DEAL_HQ_FINANCIAL_FIELDS) {
    delete clone[field];
  }
  return clone as WithoutDealHqFinancials<T>;
}

export function maskDealFinancialsList<T extends object>(
  ctx: AccessContext,
  records: readonly T[],
): Array<T | WithoutDealHqFinancials<T>> {
  if (can(ctx, 'deal:compensation')) return [...records];
  return records.map((r) => maskDealFinancials(ctx, r));
}
