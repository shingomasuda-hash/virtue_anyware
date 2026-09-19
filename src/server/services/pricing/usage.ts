import { roundTo } from '@/lib/money';

/** 月ごとの季節係数（1-12 → 係数）。 */
export type SeasonalCoefficientMap = Readonly<Record<number, number>>;

export interface EstimatedUsageInput {
  /** 電気料金明細に記載された実使用量(kWh) */
  actualUsageKwh: number | null | undefined;
  /** 明細の検針月(1-12) */
  usageMonth: number | null | undefined;
  coefficients: SeasonalCoefficientMap;
}

export interface EstimatedUsage {
  actualUsageKwh: number | null;
  usageMonth: number | null;
  coefficient: number | null;
  estimatedUsageKwh: number | null;
  /** 係数が見つからず 1.0 として計算した場合に true */
  coefficientMissing: boolean;
}

/**
 * 想定使用量を算出する。
 *
 *   想定使用量(kWh) = 明細の実使用量(kWh) × 季節係数[検針月]
 *
 * 季節係数は月ごとの使用量のブレを平準化するためのもの。
 * 使用量が多い月（1月・8月）は 100% 未満、少ない月（5月・6月・11月）は 100% 超になる。
 *
 * ※ 乗算か除算かは条件表に明記されていないため、
 *    「ピーク月の係数が 100% 未満 = 実績を引き下げて平準化する」という読みで**乗算**としている。
 *    運用と異なる場合は `SEASONAL_COEFFICIENT_MODE` の切り替えだけで対応できる
 *    （docs/08_REVENUE_MODEL.md / ASSUMPTIONS C-9）。
 */
export const SEASONAL_COEFFICIENT_MODE: 'multiply' | 'divide' = 'multiply';

export function calcEstimatedUsage(input: EstimatedUsageInput): EstimatedUsage {
  const actual =
    typeof input.actualUsageKwh === 'number' && Number.isFinite(input.actualUsageKwh)
      ? input.actualUsageKwh
      : null;
  const month =
    typeof input.usageMonth === 'number' && input.usageMonth >= 1 && input.usageMonth <= 12
      ? input.usageMonth
      : null;

  if (actual === null) {
    return { actualUsageKwh: null, usageMonth: month, coefficient: null, estimatedUsageKwh: null, coefficientMissing: false };
  }

  const found = month === null ? undefined : input.coefficients[month];
  const coefficientMissing = found === undefined;
  const coefficient = found ?? 1;

  const estimated =
    SEASONAL_COEFFICIENT_MODE === 'multiply' ? actual * coefficient : coefficient === 0 ? actual : actual / coefficient;

  return {
    actualUsageKwh: actual,
    usageMonth: month,
    coefficient: roundTo(coefficient, 6),
    estimatedUsageKwh: roundTo(estimated, 2),
    coefficientMissing,
  };
}
