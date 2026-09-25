import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { calcCompensation } from '@/server/services/deals/compensation';
import { DomainError } from '@/lib/errors';

/**
 * 報酬計算の検算。
 *
 * 現行スプレッドシートの計算済み列（原価合計・営業利益・各コミッション・会社残粗利）を
 * 正解として、実装が同じ値を出すことを全 21 件で確認する。
 * 計算式を後から変えたときに、現行運用との差異を必ず検出できるようにするためのテスト。
 *
 * ただしスプレッドシート側には浮動小数点の誤差が残っている
 * （A0027 の営業コミッションが 489999.99999999994。正しくは 1,400,000 × 0.35 = 490,000）。
 * 実装は円未満を四捨五入するため、期待値も同じく丸めて比較する。
 * 支払額に 1 円未満の端数を持たせないことが目的で、ASSUMPTIONS D2-2 に記録している。
 */

/** スプレッドシートの浮動小数点誤差を取り除いた期待値。 */
const expectYen = (value: string) => Math.round(Number(value));

interface Row {
  案件ID: string;
  '販売価格(税抜)': string;
  設備費: string;
  工事代: string;
  延長保証料: string;
  その他原価: string;
  原価合計: string;
  営業利益: string;
  控除額: string;
  営業コミッション率: string;
  営業コミッション: string;
  代理店コミッション率: string;
  代理店コミッション: string;
  会社残粗利: string;
}

const csv = readFileSync(new URL('../../prisma/seed/data/deal-compensations.csv', import.meta.url), 'utf8');
const rows = Papa.parse<Row>(csv, { header: true, skipEmptyLines: true }).data;

describe('報酬計算（docs/15_DEAL_MANAGEMENT.md 15.4）', () => {
  it('ダミーデータが読み込めている', () => {
    expect(rows).toHaveLength(21);
  });

  it.each(rows.map((row) => [row.案件ID, row] as const))('%s の計算がスプレッドシートと一致する', (_id, row) => {
    const result = calcCompensation({
      salesPriceExclTax: row['販売価格(税抜)'],
      equipmentCost: row.設備費,
      constructionCost: row.工事代,
      extendedWarrantyCost: row.延長保証料,
      otherCost: row.その他原価,
      deductionAmount: row.控除額,
      salesCommissionRate: row.営業コミッション率,
      agencyCommissionRate: row.代理店コミッション率,
    });

    expect(result.totalCost).toBe(expectYen(row.原価合計));
    expect(result.grossProfit).toBe(expectYen(row.営業利益));
    expect(result.salesCommission).toBe(expectYen(row.営業コミッション));
    expect(result.agencyCommission).toBe(expectYen(row.代理店コミッション));
    expect(result.companyGrossProfit).toBe(expectYen(row.会社残粗利));
  });

  it('赤字案件ではコミッションが 0 になり、損失は会社側に残る', () => {
    const result = calcCompensation({
      salesPriceExclTax: 1_960_000,
      equipmentCost: 1_720_000,
      constructionCost: 540_000,
      extendedWarrantyCost: 100_000,
      otherCost: 50_000,
      deductionAmount: 250_000,
      salesCommissionRate: 0.3,
      agencyCommissionRate: 0.2,
    });
    expect(result.grossProfit).toBe(-450_000);
    expect(result.commissionBase).toBe(0);
    expect(result.salesCommission).toBe(0);
    expect(result.agencyCommission).toBe(0);
    expect(result.companyGrossProfit).toBe(-450_000);
  });

  it('控除額が営業利益を上回る場合もコミッションは 0（マイナスにしない）', () => {
    const result = calcCompensation({
      salesPriceExclTax: 1_000_000,
      equipmentCost: 900_000,
      constructionCost: 0,
      extendedWarrantyCost: 0,
      otherCost: 0,
      deductionAmount: 250_000,
      salesCommissionRate: 0.3,
      agencyCommissionRate: 0.2,
    });
    expect(result.grossProfit).toBe(100_000);
    expect(result.commissionBase).toBe(0);
    expect(result.companyGrossProfit).toBe(100_000);
  });

  it('営業利益 = 営業コミッション + 代理店コミッション + 会社残粗利 が常に成立する', () => {
    for (const row of rows) {
      const r = calcCompensation({
        salesPriceExclTax: row['販売価格(税抜)'],
        equipmentCost: row.設備費,
        constructionCost: row.工事代,
        extendedWarrantyCost: row.延長保証料,
        otherCost: row.その他原価,
        deductionAmount: row.控除額,
        salesCommissionRate: row.営業コミッション率,
        agencyCommissionRate: row.代理店コミッション率,
      });
      expect(r.salesCommission + r.agencyCommission + r.companyGrossProfit).toBe(r.grossProfit);
    }
  });

  it('率を % のまま（30 など）入力すると拒否する', () => {
    expect(() =>
      calcCompensation({
        salesPriceExclTax: 3_000_000,
        equipmentCost: 1_000_000,
        constructionCost: 0,
        extendedWarrantyCost: 0,
        otherCost: 0,
        deductionAmount: 0,
        salesCommissionRate: 30,
        agencyCommissionRate: 0.2,
      }),
    ).toThrow(DomainError);
  });

  it('原価にマイナスを入力すると拒否する', () => {
    expect(() =>
      calcCompensation({
        salesPriceExclTax: 3_000_000,
        equipmentCost: -1,
        constructionCost: 0,
        extendedWarrantyCost: 0,
        otherCost: 0,
        deductionAmount: 0,
        salesCommissionRate: 0.3,
        agencyCommissionRate: 0.2,
      }),
    ).toThrow(DomainError);
  });
});
