import { roundYen, toNumber, type Numeric } from '@/lib/money';
import { DomainError } from '@/lib/errors';

/**
 * 案件の報酬（コミッション）計算。docs/15_DEAL_MANAGEMENT.md 15.4。
 *
 * 現行の Google スプレッドシートの計算式を逆算したもので、
 * 提供されたダミーデータ 21 件すべてと一致することを確認している。
 *
 *   原価合計           = 設備費 + 工事代 + 延長保証料 + その他原価
 *   営業利益           = 販売価格(税抜) − 原価合計
 *   コミッション対象額 = max(0, 営業利益 − 控除額)
 *   営業コミッション   = コミッション対象額 × 営業コミッション率
 *   代理店コミッション = コミッション対象額 × 代理店コミッション率
 *   会社残粗利         = 営業利益 − 営業コミッション − 代理店コミッション
 *
 * 計算はこのファイルだけで行う。画面・Server Action では再計算しない（§34）。
 */

export interface CompensationInput {
  /** 販売価格（税抜）。案件側の値。 */
  salesPriceExclTax: Numeric | null | undefined;
  equipmentCost: Numeric | null | undefined;
  constructionCost: Numeric | null | undefined;
  extendedWarrantyCost: Numeric | null | undefined;
  otherCost: Numeric | null | undefined;
  deductionAmount: Numeric | null | undefined;
  salesCommissionRate: Numeric | null | undefined;
  agencyCommissionRate: Numeric | null | undefined;
}

export interface CompensationResult {
  totalCost: number;
  grossProfit: number;
  /** max(0, 営業利益 − 控除額) */
  commissionBase: number;
  salesCommission: number;
  agencyCommission: number;
  companyGrossProfit: number;
}

/** 率は 0〜1（0%〜100%）で受け取る。35 のような入力は桁誤りとして弾く。 */
function assertRate(value: number, label: string): void {
  if (value < 0 || value > 1) {
    throw new DomainError(`${label}は 0〜1 の範囲で入力してください（30% なら 0.3）。`);
  }
}

function assertNotNegative(value: number, label: string): void {
  if (value < 0) {
    throw new DomainError(`${label}にマイナスの値は入力できません。`);
  }
}

export function calcCompensation(input: CompensationInput): CompensationResult {
  const salesPrice = toNumber(input.salesPriceExclTax);
  const equipmentCost = toNumber(input.equipmentCost);
  const constructionCost = toNumber(input.constructionCost);
  const extendedWarrantyCost = toNumber(input.extendedWarrantyCost);
  const otherCost = toNumber(input.otherCost);
  const deduction = toNumber(input.deductionAmount);
  const salesRate = toNumber(input.salesCommissionRate);
  const agencyRate = toNumber(input.agencyCommissionRate);

  assertNotNegative(salesPrice, '販売価格');
  assertNotNegative(equipmentCost, '設備費');
  assertNotNegative(constructionCost, '工事代');
  assertNotNegative(extendedWarrantyCost, '延長保証料');
  assertNotNegative(otherCost, 'その他原価');
  assertNotNegative(deduction, '控除額');
  assertRate(salesRate, '営業コミッション率');
  assertRate(agencyRate, '代理店コミッション率');

  const totalCost = roundYen(equipmentCost + constructionCost + extendedWarrantyCost + otherCost);
  const grossProfit = roundYen(salesPrice - totalCost);

  // 赤字案件（販売価格 < 原価）ではコミッションを発生させない。
  // 会社残粗利はマイナスのまま残り、損失が営業・代理店へ転嫁されない。
  const commissionBase = Math.max(0, roundYen(grossProfit - deduction));

  const salesCommission = roundYen(commissionBase * salesRate);
  const agencyCommission = roundYen(commissionBase * agencyRate);

  // 丸め後の金額から引くことで、3 つの合計が必ず営業利益と一致する。
  const companyGrossProfit = grossProfit - salesCommission - agencyCommission;

  return { totalCost, grossProfit, commissionBase, salesCommission, agencyCommission, companyGrossProfit };
}
