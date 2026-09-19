import { safeDivide, safeRatioOrNull } from '@/lib/money';

/**
 * KPI 定義の唯一の実装。docs/KPI_DEFINITIONS.md と 1:1 で対応する。
 * 画面ごとに別の式を書いてはならない（§86）。
 */

export interface ContractFact {
  isCancelled: boolean;
  isDefect: boolean;
  isActivated: boolean;
  watt: number;
  hqRevenue: number;
  agencyPayout: number;
  hqGrossProfit: number;
}

export interface SalesKpi {
  totalContracts: number;
  activeContracts: number;
  cancelledContracts: number;
  defectContracts: number;
  activatedContracts: number;
  cancellationRate: number;
  activationRate: number;
  totalWatt: number;
  averageWatt: number;
  hqRevenue: number;
  agencyPayout: number;
  hqGrossProfit: number;
  grossMargin: number;
  averageContractValue: number;
}

/**
 * 販売KPIの集計。
 * 売上・支払・粗利は **キャンセルを除いた契約**のみを対象にする（§35）。
 */
export function aggregateSalesKpi(contracts: readonly ContractFact[]): SalesKpi {
  const total = contracts.length;
  const active = contracts.filter((c) => !c.isCancelled);
  const cancelled = total - active.length;

  const totalWatt = sum(active, (c) => c.watt);
  const hqRevenue = sum(active, (c) => c.hqRevenue);
  const agencyPayout = sum(active, (c) => c.agencyPayout);
  const hqGrossProfit = sum(active, (c) => c.hqGrossProfit);
  const activated = active.filter((c) => c.isActivated).length;

  return {
    totalContracts: total,
    activeContracts: active.length,
    cancelledContracts: cancelled,
    defectContracts: contracts.filter((c) => c.isDefect).length,
    activatedContracts: activated,
    cancellationRate: safeDivide(cancelled, total),
    activationRate: safeDivide(activated, active.length),
    totalWatt,
    averageWatt: safeDivide(totalWatt, active.length),
    hqRevenue,
    agencyPayout,
    hqGrossProfit,
    grossMargin: safeDivide(hqGrossProfit, hqRevenue),
    averageContractValue: safeDivide(hqRevenue, active.length),
  };
}

export const emptySalesKpi = (): SalesKpi => aggregateSalesKpi([]);

/** 催事ファネル。取得できていない段階（null）は転換率の計算から除外する。 */
export interface FunnelStep {
  key: string;
  label: string;
  count: number;
}

export interface FunnelStepWithRate extends FunnelStep {
  /** 直前段階からの転換率。先頭は null。 */
  conversionRate: number | null;
  /** 最上段からの通過率。 */
  overallRate: number | null;
}

export function withConversionRates(steps: readonly FunnelStep[]): FunnelStepWithRate[] {
  const head = steps[0];
  return steps.map((step, index) => {
    const prev = index === 0 ? null : steps[index - 1];
    return {
      ...step,
      conversionRate: prev ? safeRatioOrNull(step.count, prev.count) : null,
      overallRate: head ? safeRatioOrNull(step.count, head.count) : null,
    };
  });
}

/** 催事PL。粗利 − 催事経費 = 催事営業利益（§52）。 */
export interface EventProfitInput {
  hqRevenue: number;
  agencyPayout: number;
  boothCost: number;
  laborCost: number;
  travelCost: number;
  lodgingCost: number;
  promotionCost: number;
  otherCost: number;
}

export interface EventProfit extends EventProfitInput {
  grossProfit: number;
  totalExpense: number;
  operatingProfit: number;
  operatingMargin: number;
  roi: number;
  boothRoi: number;
}

export function calcEventProfit(input: EventProfitInput): EventProfit {
  const grossProfit = input.hqRevenue - input.agencyPayout;
  const totalExpense =
    input.boothCost +
    input.laborCost +
    input.travelCost +
    input.lodgingCost +
    input.promotionCost +
    input.otherCost;
  const operatingProfit = grossProfit - totalExpense;
  return {
    ...input,
    grossProfit,
    totalExpense,
    operatingProfit,
    operatingMargin: safeDivide(operatingProfit, input.hqRevenue),
    roi: safeDivide(operatingProfit, totalExpense),
    boothRoi: safeDivide(operatingProfit, input.boothCost),
  };
}

/** 獲得コスト。分母 0 は 0（費用ゼロで獲得したケースを Infinity にしない）。 */
export function calcCpa(totalExpense: number, contractCount: number): number {
  return safeDivide(totalExpense, contractCount);
}

/** 前月比など「比較不能」を表現すべき指標は null を返す。 */
export function calcChangeRate(current: number, previous: number): number | null {
  return safeRatioOrNull(current - previous, previous);
}

function sum<T>(items: readonly T[], selector: (item: T) => number): number {
  return items.reduce((acc, item) => acc + selector(item), 0);
}
