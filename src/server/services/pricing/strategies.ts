import type { PriceUnitType } from '@/generated/prisma';
import { roundYen } from '@/lib/money';

export interface AmountInput {
  /** 契約数量（電力なら W、件数商材なら 1）。 */
  quantity: number;
  /** 率計算（太陽光紹介料など）の基準額。 */
  baseAmount?: number;
  unitPrice: number;
  /** PERCENT_OF_AMOUNT のときの率（0-1）。未指定なら unitPrice を率として扱う。 */
  rate?: number | null;
}

export type AmountStrategy = (input: AmountInput) => number;

/**
 * 単価の適用方法ごとの金額計算。
 * 商流が変わった場合は**ここにストラテジを追加するだけ**で済むようにしている（§6）。
 */
export const AMOUNT_STRATEGIES: Record<PriceUnitType, AmountStrategy> = {
  // 電力: 契約ワット数 × 円/W
  PER_WATT: ({ quantity, unitPrice }) => roundYen(quantity * unitPrice),
  // 通信・ウォーターサーバー等: 1件あたり定額 × 件数
  PER_CONTRACT: ({ quantity, unitPrice }) => roundYen((quantity || 1) * unitPrice),
  // 太陽光紹介料等: 販売額 × 率
  PERCENT_OF_AMOUNT: ({ baseAmount, unitPrice, rate }) =>
    roundYen((baseAmount ?? 0) * (rate ?? unitPrice)),
  // 固定報酬
  FIXED: ({ unitPrice }) => roundYen(unitPrice),
};

export function calcAmount(unitType: PriceUnitType, input: AmountInput): number {
  const strategy = AMOUNT_STRATEGIES[unitType];
  return strategy(input);
}
