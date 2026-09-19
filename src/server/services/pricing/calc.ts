import type { PriceUnitType } from '@/generated/prisma';
import { roundTo, safeDivide } from '@/lib/money';
import { calcAmount, dependsOnAgencyPayout } from './strategies';
import { lookupTier, type PriceTier } from './tiers';

export interface ResolvedPrice {
  unitType: PriceUnitType;
  unitPrice: number;
  rate?: number | null;
  /** TIERED_BY_USAGE のときの階段表。 */
  tiers?: readonly PriceTier[];
  /** 適用した単価レコードの ID（スナップショットの根拠として保存する）。 */
  sourceId?: string | null;
  /**
   * 一致したスコープ数。代理店マスタ単価と単価ルールのどちらを採るかの判定に使う。
   * 値が大きいほど具体的。
   */
  specificity?: number;
}

export interface ContractAmountInput {
  quantity: number;
  baseAmount?: number;
  /** 階段表の参照キー（想定使用量 kWh）。 */
  estimatedUsage?: number | null;
  /** 手数料からの控除額（業務管理費など）。代理店支払から差し引く。 */
  deduction?: number;
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
  /** 適用した階段表の行 ID（算定根拠としてスナップショットに残す） */
  hqTierId: string | null;
  agencyTierId: string | null;
  /** 控除額（業務管理費など） */
  deduction: number;
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
  const { quantity, baseAmount, estimatedUsage, hq, agency } = input;
  const deduction = input.deduction ?? 0;

  const common = { quantity, baseAmount, estimatedUsage };

  // 代理店支払を先に確定する。本部受取が「代理店fee + 10%」のように
  // 代理店支払へ依存する商流（エバーグリーン等）があるため、この順序が必要。
  const agencyGross = agency
    ? calcAmount(agency.unitType, {
        ...common,
        unitPrice: agency.unitPrice,
        rate: agency.rate,
        tiers: agency.tiers,
      })
    : 0;
  const agencyPayout = Math.max(0, agencyGross - deduction);

  const hqRevenue = calcAmount(hq.unitType, {
    ...common,
    unitPrice: hq.unitPrice,
    rate: hq.rate,
    tiers: hq.tiers,
    // MARKUP_ON_PAYOUT では控除前の代理店手数料に率を掛ける
    agencyPayout: agencyGross,
  });

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
    hqTierId:
      hq.unitType === 'TIERED_BY_USAGE'
        ? (lookupTier(hq.tiers ?? [], estimatedUsage ?? 0).tier?.id ?? null)
        : null,
    agencyTierId:
      agency?.unitType === 'TIERED_BY_USAGE'
        ? (lookupTier(agency.tiers ?? [], estimatedUsage ?? 0).tier?.id ?? null)
        : null,
    deduction,
  };
}

export { dependsOnAgencyPayout };
