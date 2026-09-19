import { describe, expect, it } from 'vitest';
import { calcContractAmounts } from '@/server/services/pricing/calc';
import { calcAmount } from '@/server/services/pricing/strategies';
import { pickMostSpecific, specificityOf } from '@/server/services/pricing/resolve';

describe('収益計算（docs/08_REVENUE_MODEL.md §8.1）', () => {
  it('§35 の検証例: 5,000W / 本部150円 / 代理店100円 → 売上750,000・支払500,000・粗利250,000', () => {
    const result = calcContractAmounts({
      quantity: 5000,
      hq: { unitType: 'PER_WATT', unitPrice: 150 },
      agency: { unitType: 'PER_WATT', unitPrice: 100 },
    });

    expect(result.hqRevenue).toBe(750_000);
    expect(result.agencyPayout).toBe(500_000);
    expect(result.hqGrossProfit).toBe(250_000);
    expect(result.grossMargin).toBeCloseTo(0.3333, 4);
  });

  it('粗利率は 33.3% として表示できる精度を持つ', () => {
    const { grossMargin } = calcContractAmounts({
      quantity: 5000,
      hq: { unitType: 'PER_WATT', unitPrice: 150 },
      agency: { unitType: 'PER_WATT', unitPrice: 100 },
    });
    expect((grossMargin * 100).toFixed(1)).toBe('33.3');
  });

  it('代理店単価が未設定でも計算が破綻しない（支払 0・粗利＝売上）', () => {
    const result = calcContractAmounts({
      quantity: 3000,
      hq: { unitType: 'PER_WATT', unitPrice: 150 },
      agency: null,
    });
    expect(result.agencyPayout).toBe(0);
    expect(result.hqGrossProfit).toBe(450_000);
    expect(result.grossMargin).toBe(1);
  });

  it('売上 0 のとき粗利率は 0（NaN / Infinity を返さない）', () => {
    const result = calcContractAmounts({
      quantity: 0,
      hq: { unitType: 'PER_WATT', unitPrice: 150 },
      agency: { unitType: 'PER_WATT', unitPrice: 100 },
    });
    expect(result.hqRevenue).toBe(0);
    expect(result.grossMargin).toBe(0);
    expect(Number.isFinite(result.grossMargin)).toBe(true);
  });

  it('計算式は unit_type ごとに差し替えられる（§6「計算式を変更できる設計」）', () => {
    expect(calcAmount('PER_WATT', { quantity: 5000, unitPrice: 150 })).toBe(750_000);
    expect(calcAmount('PER_CONTRACT', { quantity: 2, unitPrice: 12_000 })).toBe(24_000);
    expect(calcAmount('PERCENT_OF_AMOUNT', { quantity: 1, baseAmount: 2_500_000, unitPrice: 0, rate: 0.1 })).toBe(250_000);
    expect(calcAmount('FIXED', { quantity: 999, unitPrice: 30_000 })).toBe(30_000);
  });

  it('太陽光の紹介料（販売額比率）も同じ計算器で扱える', () => {
    const result = calcContractAmounts({
      quantity: 1,
      baseAmount: 2_500_000,
      hq: { unitType: 'PERCENT_OF_AMOUNT', unitPrice: 0, rate: 0.1 },
      agency: { unitType: 'PERCENT_OF_AMOUNT', unitPrice: 0, rate: 0.04 },
    });
    expect(result.hqRevenue).toBe(250_000);
    expect(result.agencyPayout).toBe(100_000);
    expect(result.hqGrossProfit).toBe(150_000);
  });
});

describe('単価ルールの解決（より具体的なルールを優先する）', () => {
  const base = {
    unitType: 'PER_WATT' as const,
    unitPrice: 0,
    rate: null,
    priority: 0,
    effectiveFrom: new Date(2026, 0, 1),
  };

  it('一致した非 NULL スコープ数を specificity とする', () => {
    expect(specificityOf({ agencyId: 'a', productId: 'p', supplierId: null, planId: null })).toBe(2);
    expect(specificityOf({ agencyId: null, productId: null, supplierId: null, planId: null })).toBe(0);
  });

  it('代理店・商材まで指定されたルールが、全社共通ルールより優先される', () => {
    const generic = { ...base, id: 'generic', agencyId: null, productId: null, supplierId: null, planId: null };
    const specific = { ...base, id: 'specific', agencyId: 'a1', productId: 'p1', supplierId: null, planId: null };
    expect(pickMostSpecific([generic, specific])?.id).toBe('specific');
  });

  it('specificity が同じなら priority、次に effectiveFrom が新しい方を採用する', () => {
    const older = { ...base, id: 'older', agencyId: 'a1', productId: null, supplierId: null, planId: null };
    const newer = { ...base, id: 'newer', agencyId: 'a1', productId: null, supplierId: null, planId: null, effectiveFrom: new Date(2026, 6, 1) };
    expect(pickMostSpecific([older, newer])?.id).toBe('newer');

    const prioritized = { ...newer, id: 'prioritized', priority: 10, effectiveFrom: new Date(2026, 0, 1) };
    expect(pickMostSpecific([newer, prioritized])?.id).toBe('prioritized');
  });

  it('該当ルールが無ければ null を返す', () => {
    expect(pickMostSpecific([])).toBeNull();
  });
});
