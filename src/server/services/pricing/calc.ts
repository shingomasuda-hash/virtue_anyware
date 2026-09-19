import type { PriceUnitType } from '@/generated/prisma';
import { roundTo, safeDivide } from '@/lib/money';
import { calcAmount } from './strategies';

export interface ResolvedPrice {
  unitType: PriceUnitType;
  unitPrice: number;
  rate?: number | null;
  /** 適用した単価レコードの ID（スナップショットの根拠として保存する）。 */
  sourceId?: string | null;
}

export interface ContractAmountInput {
  quantity: number;
  baseAmount?: number;
  hq: ResolvedPrice;
  agency: ResolvedPrice | null;
}

export interface ContractAmounts {
  hqUnitPrice: number;
  agencyUnitPrice: number;
  hqRevenue: number;
  agencyPayout: number;
  hqGrossProfit: number;
  grossMargin: number;
  hqUnitType: PriceUnitType;
  agencyUnitType: PriceUnitType;
}

/**
 * 契約金額の唯一の計算式（docs/08_REVENUE_MODEL.md 8.1）。
 *
 *   hq_revenue      = f(unitType, quantity, hq_unit_price)
 *   agency_payout   = f(unitType, quantity, agency_unit_price)
 *   hq_gross_profit = hq_revenue - agency_payout
 *   gross_margin    = hq_gross_profit / hq_revenue   （0 除算は 0）
 *
 * 画面・API・集計はすべてこの関数の結果（=契約行のスナップショット）を使う。
 */
export function calcContractAmounts(input: ContractAmountInput): ContractAmounts {
  const { quantity, baseAmount, hq, agency } = input;

  const hqRevenue = calcAmount(hq.unitType, {
    quantity,
    baseAmount,
    unitPrice: hq.unitPrice,
    rate: hq.rate,
  });

  const agencyPayout = agency
    ? calcAmount(agency.unitType, {
        quantity,
        baseAmount,
        unitPrice: agency.unitPrice,
        rate: agency.rate,
      })
    : 0;

  const hqGrossProfit = hqRevenue - agencyPayout;

  return {
    hqUnitPrice: hq.unitPrice,
    agencyUnitPrice: agency?.unitPrice ?? 0,
    hqRevenue,
    agencyPayout,
    hqGrossProfit,
    grossMargin: roundTo(safeDivide(hqGrossProfit, hqRevenue), 6),
    hqUnitType: hq.unitType,
    agencyUnitType: agency?.unitType ?? hq.unitType,
  };
}
