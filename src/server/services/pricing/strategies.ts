import type { PriceUnitType } from '@/generated/prisma';
import { roundYen } from '@/lib/money';
import { lookupTier, type PriceTier } from './tiers';

export interface AmountInput {
  /** 契約数量（電力なら W、件数商材なら 1）。 */
  quantity: number;
  /** 率計算（太陽光紹介料など）の基準額。 */
  baseAmount?: number;
  unitPrice: number;
  /** PERCENT_OF_AMOUNT / MARKUP_ON_PAYOUT のときの率（0-1）。未指定なら unitPrice を率として扱う。 */
  rate?: number | null;
  /** TIERED_BY_USAGE のときの階段表。 */
  tiers?: readonly PriceTier[];
  /** TIERED_BY_USAGE の参照キー（想定使用量 kWh）。 */
  estimatedUsage?: number | null;
  /** MARKUP_ON_PAYOUT で本部受取を導出するための代理店支払額。 */
  agencyPayout?: number;
}

export type AmountStrategy = (input: AmountInput) => number;

/**
 * 単価の適用方法ごとの金額計算。
 * 商流が変わった場合は**ここにストラテジを追加するだけ**で済むようにしている（§6）。
 *
 * Record<PriceUnitType, …> にしているため、enum に値を足すと
 * ここを実装するまで型エラーになる（実装漏れを防ぐ）。
 */
export const AMOUNT_STRATEGIES: Record<PriceUnitType, AmountStrategy> = {
  // 電力(W課金): 契約ワット数 × 円/W
  PER_WATT: ({ quantity, unitPrice }) => roundYen(quantity * unitPrice),

  // 通信・ウォーターサーバー等: 1件あたり定額 × 件数
  PER_CONTRACT: ({ quantity, unitPrice }) => roundYen((quantity || 1) * unitPrice),

  // 太陽光紹介料等: 販売額 × 率
  PERCENT_OF_AMOUNT: ({ baseAmount, unitPrice, rate }) =>
    roundYen((baseAmount ?? 0) * (rate ?? unitPrice)),

  // 固定報酬
  FIXED: ({ unitPrice }) => roundYen(unitPrice),

  // 想定使用量(kWh)の階段表から引く（エバーグリーン MPプラン等）
  TIERED_BY_USAGE: ({ tiers, estimatedUsage }) =>
    lookupTier(tiers ?? [], estimatedUsage ?? 0).amount,

  // 代理店支払額に率を上乗せして本部受取を導出する（例: 代理店fee + 10%）
  MARKUP_ON_PAYOUT: ({ agencyPayout, rate, unitPrice }) =>
    roundYen((agencyPayout ?? 0) * (1 + (rate ?? unitPrice))),
};

export function calcAmount(unitType: PriceUnitType, input: AmountInput): number {
  const strategy = AMOUNT_STRATEGIES[unitType];
  return strategy(input);
}

/** その単価方式が代理店支払額に依存するか（＝代理店側を先に計算する必要があるか）。 */
export function dependsOnAgencyPayout(unitType: PriceUnitType): boolean {
  return unitType === 'MARKUP_ON_PAYOUT';
}
