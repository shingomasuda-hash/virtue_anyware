import { describe, expect, it } from 'vitest';
import { lookupTier, validateTiers, type PriceTier } from '@/server/services/pricing/tiers';
import { calcEstimatedUsage } from '@/server/services/pricing/usage';
import { calcContractAmounts } from '@/server/services/pricing/calc';
import { calcAmount } from '@/server/services/pricing/strategies';
import {
  MP_PLAN_TIERS,
  SEASONAL_COEFFICIENTS,
  HQ_MARKUP_RATE,
  NO_STATEMENT_FEE,
  MANAGEMENT_FEE,
} from '../../prisma/seed/evergreen';

const TIERS: PriceTier[] = MP_PLAN_TIERS.map((t, i) => ({
  id: `tier-${i}`,
  minValue: t.min,
  maxValue: t.max,
  amount: t.amount,
}));

describe('成約事務手数料対照表（階段表）', () => {
  it('条件表どおりの金額を引ける', () => {
    expect(lookupTier(TIERS, 49).amount).toBe(0); // 50未満
    expect(lookupTier(TIERS, 50).amount).toBe(3_600); // 50以上100未満
    expect(lookupTier(TIERS, 99.9).amount).toBe(3_600);
    expect(lookupTier(TIERS, 300).amount).toBe(25_200); // 300以上350未満
    expect(lookupTier(TIERS, 500).amount).toBe(41_400); // 500以上550未満
    expect(lookupTier(TIERS, 1_000).amount).toBe(86_400); // 1000以上1050未満
    expect(lookupTier(TIERS, 1_449.99).amount).toBe(122_400); // 1400以上1450未満
  });

  it('1450以上は上限なしで同額になる', () => {
    expect(lookupTier(TIERS, 1_450).amount).toBe(126_900);
    expect(lookupTier(TIERS, 5_000).amount).toBe(126_900);
    expect(lookupTier(TIERS, 999_999).amount).toBe(126_900);
  });

  it('境界は「以上・未満」で判定する（400 は 400以上450未満 の側）', () => {
    expect(lookupTier(TIERS, 399.99).amount).toBe(29_700); // 350以上400未満
    expect(lookupTier(TIERS, 400).amount).toBe(32_400); // 400以上450未満
    expect(lookupTier(TIERS, 449.99).amount).toBe(32_400);
    expect(lookupTier(TIERS, 450).amount).toBe(36_900);
  });

  it('条件表の 30 段すべてが登録され、隙間も重複もない', () => {
    expect(TIERS).toHaveLength(30);
    const issues = validateTiers(TIERS);
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    // 1450以上が上限なしのため「上限未定義」の警告も出ない
    expect(issues.filter((i) => i.message.includes('隙間'))).toEqual([]);
  });

  it('階段表の不備（隙間・重複・上限逆転）を検出する', () => {
    const gap = validateTiers([
      { minValue: 0, maxValue: 100, amount: 0 },
      { minValue: 200, maxValue: 300, amount: 100 },
    ]);
    expect(gap.some((i) => i.message.includes('隙間'))).toBe(true);

    const overlap = validateTiers([
      { minValue: 0, maxValue: 300, amount: 0 },
      { minValue: 200, maxValue: 400, amount: 100 },
    ]);
    expect(overlap.some((i) => i.level === 'error' && i.message.includes('重複'))).toBe(true);

    const inverted = validateTiers([{ minValue: 300, maxValue: 100, amount: 0 }]);
    expect(inverted.some((i) => i.level === 'error' && i.message.includes('上限が下限以下'))).toBe(true);
  });
});

describe('季節係数と想定使用量', () => {
  it('想定使用量 = 明細の使用量 × 検針月の季節係数', () => {
    // 8月検針・500kWh → 500 × 0.867 = 433.5kWh
    const august = calcEstimatedUsage({ actualUsageKwh: 500, usageMonth: 8, coefficients: SEASONAL_COEFFICIENTS });
    expect(august.coefficient).toBe(0.867);
    expect(august.estimatedUsageKwh).toBe(433.5);

    // 6月検針・500kWh → 500 × 1.164 = 582kWh
    const june = calcEstimatedUsage({ actualUsageKwh: 500, usageMonth: 6, coefficients: SEASONAL_COEFFICIENTS });
    expect(june.estimatedUsageKwh).toBe(582);
  });

  it('同じ使用量でも検針月によって適用される階段が変わる', () => {
    // 8月: 433.5kWh → 400以上450未満 → 32,400円
    const august = calcEstimatedUsage({ actualUsageKwh: 500, usageMonth: 8, coefficients: SEASONAL_COEFFICIENTS });
    expect(lookupTier(TIERS, august.estimatedUsageKwh ?? 0).amount).toBe(32_400);

    // 6月: 582kWh → 550以上600未満 → 45,900円
    const june = calcEstimatedUsage({ actualUsageKwh: 500, usageMonth: 6, coefficients: SEASONAL_COEFFICIENTS });
    expect(lookupTier(TIERS, june.estimatedUsageKwh ?? 0).amount).toBe(45_900);
  });

  it('検針月が不明なら係数 1.0 として扱い、その旨を返す', () => {
    const result = calcEstimatedUsage({ actualUsageKwh: 500, usageMonth: null, coefficients: SEASONAL_COEFFICIENTS });
    expect(result.coefficient).toBe(1);
    expect(result.estimatedUsageKwh).toBe(500);
    expect(result.coefficientMissing).toBe(true);
  });

  it('使用量が無ければ想定使用量も null（0 と区別する）', () => {
    const result = calcEstimatedUsage({ actualUsageKwh: null, usageMonth: 8, coefficients: SEASONAL_COEFFICIENTS });
    expect(result.estimatedUsageKwh).toBeNull();
  });

  it('季節係数は 12 か月すべて登録されている', () => {
    expect(Object.keys(SEASONAL_COEFFICIENTS)).toHaveLength(12);
    for (let month = 1; month <= 12; month += 1) {
      expect(SEASONAL_COEFFICIENTS[month]).toBeGreaterThan(0);
    }
  });
});

describe('VIRTUE 受取単価 = 代理店手数料 + 10%', () => {
  it('階段表の手数料に 10% を上乗せして本部受取を導出する', () => {
    // 6月検針 500kWh → 想定 582kWh → 代理店 45,900円 → 本部 50,490円
    const usage = calcEstimatedUsage({ actualUsageKwh: 500, usageMonth: 6, coefficients: SEASONAL_COEFFICIENTS });

    const result = calcContractAmounts({
      quantity: 0,
      estimatedUsage: usage.estimatedUsageKwh,
      hq: { unitType: 'MARKUP_ON_PAYOUT', unitPrice: 0, rate: HQ_MARKUP_RATE },
      agency: { unitType: 'TIERED_BY_USAGE', unitPrice: 0, tiers: TIERS },
    });

    expect(result.agencyPayout).toBe(45_900);
    expect(result.hqRevenue).toBe(50_490);
    expect(result.hqGrossProfit).toBe(4_590);
    // 粗利率 = 4,590 / 50,490 = 9.09%
    expect(result.grossMargin).toBeCloseTo(0.0909, 4);
  });

  it('適用した階段表の行 ID を算定根拠として返す', () => {
    const result = calcContractAmounts({
      quantity: 0,
      estimatedUsage: 582,
      hq: { unitType: 'MARKUP_ON_PAYOUT', unitPrice: 0, rate: HQ_MARKUP_RATE },
      agency: { unitType: 'TIERED_BY_USAGE', unitPrice: 0, tiers: TIERS },
    });
    expect(result.agencyTierId).toBe('tier-11'); // 550以上600未満
    expect(result.hqTierId).toBeNull(); // 本部側は階段表ではない
  });

  it('手数料 0 円（50kWh 未満）でも粗利率が NaN にならない', () => {
    const result = calcContractAmounts({
      quantity: 0,
      estimatedUsage: 30,
      hq: { unitType: 'MARKUP_ON_PAYOUT', unitPrice: 0, rate: HQ_MARKUP_RATE },
      agency: { unitType: 'TIERED_BY_USAGE', unitPrice: 0, tiers: TIERS },
    });
    expect(result.agencyPayout).toBe(0);
    expect(result.hqRevenue).toBe(0);
    expect(result.grossMargin).toBe(0);
  });

  it('MARKUP_ON_PAYOUT 単体の挙動', () => {
    expect(calcAmount('MARKUP_ON_PAYOUT', { quantity: 0, unitPrice: 0, rate: 0.1, agencyPayout: 45_900 })).toBe(50_490);
    expect(calcAmount('MARKUP_ON_PAYOUT', { quantity: 0, unitPrice: 0, rate: 0.1, agencyPayout: 0 })).toBe(0);
  });
});

describe('条件表の但し書き', () => {
  it('明細の写真がない場合は定額 3,600 円（税抜）になる', () => {
    const result = calcContractAmounts({
      quantity: 0,
      estimatedUsage: 582, // 本来なら 45,900 円
      hq: { unitType: 'MARKUP_ON_PAYOUT', unitPrice: 0, rate: HQ_MARKUP_RATE },
      agency: { unitType: 'FIXED', unitPrice: NO_STATEMENT_FEE },
    });
    expect(result.agencyPayout).toBe(NO_STATEMENT_FEE);
    expect(result.hqRevenue).toBe(3_960);
  });

  it('マッチング確認案件は業務管理費 1,000 円を手数料と相殺する', () => {
    const result = calcContractAmounts({
      quantity: 0,
      estimatedUsage: 582,
      deduction: MANAGEMENT_FEE,
      hq: { unitType: 'MARKUP_ON_PAYOUT', unitPrice: 0, rate: HQ_MARKUP_RATE },
      agency: { unitType: 'TIERED_BY_USAGE', unitPrice: 0, tiers: TIERS },
    });

    // 代理店支払は控除後、本部受取は控除前の手数料に 10%
    expect(result.agencyPayout).toBe(44_900);
    expect(result.hqRevenue).toBe(50_490);
    expect(result.deduction).toBe(1_000);
    // 控除分だけ本部粗利が増える
    expect(result.hqGrossProfit).toBe(5_590);
  });

  it('控除額が手数料を上回っても支払がマイナスにならない', () => {
    const result = calcContractAmounts({
      quantity: 0,
      estimatedUsage: 30, // 0 円
      deduction: MANAGEMENT_FEE,
      hq: { unitType: 'MARKUP_ON_PAYOUT', unitPrice: 0, rate: HQ_MARKUP_RATE },
      agency: { unitType: 'TIERED_BY_USAGE', unitPrice: 0, tiers: TIERS },
    });
    expect(result.agencyPayout).toBe(0);
  });
});

describe('既存の 円/W 商流は影響を受けない（後方互換）', () => {
  it('5,000W / 150円 / 100円 → 750,000・500,000・250,000 のまま', () => {
    const result = calcContractAmounts({
      quantity: 5000,
      hq: { unitType: 'PER_WATT', unitPrice: 150 },
      agency: { unitType: 'PER_WATT', unitPrice: 100 },
    });
    expect(result.hqRevenue).toBe(750_000);
    expect(result.agencyPayout).toBe(500_000);
    expect(result.hqGrossProfit).toBe(250_000);
    expect(result.grossMargin).toBeCloseTo(0.3333, 4);
    expect(result.deduction).toBe(0);
    expect(result.hqTierId).toBeNull();
  });
});
