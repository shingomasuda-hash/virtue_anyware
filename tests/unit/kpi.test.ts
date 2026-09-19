import { describe, expect, it } from 'vitest';
import {
  aggregateSalesKpi,
  calcChangeRate,
  calcCpa,
  calcEventProfit,
  withConversionRates,
  type ContractFact,
} from '@/server/services/kpi/definitions';

function fact(overrides: Partial<ContractFact> = {}): ContractFact {
  return {
    isCancelled: false,
    isDefect: false,
    isActivated: true,
    watt: 5000,
    hqRevenue: 750_000,
    agencyPayout: 500_000,
    hqGrossProfit: 250_000,
    ...overrides,
  };
}

describe('販売KPI（docs/KPI_DEFINITIONS.md §1-2）', () => {
  it('§35: キャンセル契約は有効売上・支払・粗利の集計から除外される', () => {
    const kpi = aggregateSalesKpi([
      fact(),
      fact(),
      fact({ isCancelled: true, hqRevenue: 900_000, agencyPayout: 600_000, hqGrossProfit: 300_000, watt: 6000 }),
    ]);

    expect(kpi.totalContracts).toBe(3);
    expect(kpi.activeContracts).toBe(2);
    expect(kpi.cancelledContracts).toBe(1);
    // キャンセル分（900,000 / 600,000 / 300,000 / 6,000W）が一切含まれないこと
    expect(kpi.hqRevenue).toBe(1_500_000);
    expect(kpi.agencyPayout).toBe(1_000_000);
    expect(kpi.hqGrossProfit).toBe(500_000);
    expect(kpi.totalWatt).toBe(10_000);
  });

  it('キャンセル率 = キャンセル件数 ÷ 総契約件数', () => {
    const kpi = aggregateSalesKpi([fact(), fact({ isCancelled: true })]);
    expect(kpi.cancellationRate).toBe(0.5);
  });

  it('契約が 0 件でも率は 0 を返す（NaN を出さない）', () => {
    const kpi = aggregateSalesKpi([]);
    expect(kpi.cancellationRate).toBe(0);
    expect(kpi.grossMargin).toBe(0);
    expect(kpi.averageWatt).toBe(0);
    expect(Number.isNaN(kpi.activationRate)).toBe(false);
  });

  it('粗利率 = 粗利 ÷ 売上', () => {
    const kpi = aggregateSalesKpi([fact()]);
    expect(kpi.grossMargin).toBeCloseTo(0.3333, 4);
  });

  it('開通率は有効契約を分母にする', () => {
    const kpi = aggregateSalesKpi([fact({ isActivated: true }), fact({ isActivated: false }), fact({ isCancelled: true })]);
    expect(kpi.activationRate).toBe(0.5);
  });
});

describe('催事PL / CPA / ROI（docs/KPI_DEFINITIONS.md §3）', () => {
  it('§52 の計算例どおりに催事利益を算出する', () => {
    const pl = calcEventProfit({
      hqRevenue: 1_500_000,
      agencyPayout: 900_000,
      boothCost: 150_000,
      laborCost: 120_000,
      travelCost: 40_000,
      lodgingCost: 30_000,
      promotionCost: 20_000,
      otherCost: 0,
    });

    expect(pl.grossProfit).toBe(600_000);
    expect(pl.totalExpense).toBe(360_000);
    expect(pl.operatingProfit).toBe(240_000);
    expect(pl.roi).toBeCloseTo(0.6667, 4);
    expect(pl.boothRoi).toBeCloseTo(1.6, 4);
  });

  it('CPA は経費 ÷ 契約件数。契約 0 件でも Infinity にしない', () => {
    expect(calcCpa(360_000, 30)).toBe(12_000);
    expect(calcCpa(360_000, 0)).toBe(0);
  });

  it('前月比は比較不能なとき null を返す', () => {
    expect(calcChangeRate(120, 100)).toBeCloseTo(0.2, 6);
    expect(calcChangeRate(120, 0)).toBeNull();
  });
});

describe('ファネル転換率', () => {
  it('直前段階からの転換率と通過率を計算する', () => {
    const steps = withConversionRates([
      { key: 'target', label: '対象', count: 100 },
      { key: 'called', label: '架電', count: 50 },
      { key: 'appointment', label: 'アポ', count: 10 },
    ]);

    expect(steps[0]?.conversionRate).toBeNull();
    expect(steps[1]?.conversionRate).toBe(0.5);
    expect(steps[2]?.conversionRate).toBe(0.2);
    expect(steps[2]?.overallRate).toBeCloseTo(0.1, 6);
  });

  it('直前段階が 0 件のとき転換率は null（比較不能）', () => {
    const steps = withConversionRates([
      { key: 'a', label: 'A', count: 0 },
      { key: 'b', label: 'B', count: 0 },
    ]);
    expect(steps[1]?.conversionRate).toBeNull();
  });
});
