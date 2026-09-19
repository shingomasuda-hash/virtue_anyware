import { canViewHqFinancials, type AccessContext } from './context';

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
