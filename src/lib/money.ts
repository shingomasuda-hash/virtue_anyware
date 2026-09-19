import type { Prisma } from '@/generated/prisma';

export type Numeric = number | string | Prisma.Decimal;

/** Decimal / string / number を number へ正規化する。計算の入口で必ず通す。 */
export function toNumber(value: Numeric | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = typeof value === 'string' ? Number(value) : Number(value.toString());
  return Number.isFinite(n) ? n : 0;
}

/** 円単位への丸め（四捨五入）。丸めはここだけで行い、画面側では行わない。 */
export function roundYen(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

/** 小数桁を指定して丸める（率などに使用）。 */
export function roundTo(value: number, digits: number): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/**
 * 分母 0 でも NaN / Infinity を返さない除算。
 * KPI の率計算は必ずこの関数を経由する（docs/KPI_DEFINITIONS.md §8）。
 */
export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || !Number.isFinite(denominator)) return fallback;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/** 比較不能（分母 0）を明示したい指標用。 */
export function safeRatioOrNull(numerator: number, denominator: number): number | null {
  if (!denominator || !Number.isFinite(denominator)) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}
