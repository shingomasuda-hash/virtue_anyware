import { Prisma, type PrismaClient } from '@/generated/prisma';
import { prisma } from '@/server/db';
import { calcContractAmounts, type ContractAmounts, type ResolvedPrice } from './calc';
import { resolveAgencyPayoutPrice, resolveHqReceivePrice, type PriceLookup } from './resolve';
import { calcEstimatedUsage, type EstimatedUsage, type SeasonalCoefficientMap } from './usage';
import { loadSeasonalCoefficients, loadFeePolicy } from './masters';

export type PrismaLike = PrismaClient | Prisma.TransactionClient;

export interface PriceContractInput {
  organizationId: string;
  agencyId: string | null;
  productId: string;
  supplierId?: string | null;
  planId?: string | null;
  quantity: number;
  baseAmount?: number | null;
  /** 適用基準日。契約日 → 申込日 → 今日 の優先で決める。 */
  basisDate: Date;

  // ── 使用量ベース算定（階段表を使う商流）──
  /** 電気料金明細に記載された実使用量(kWh) */
  actualUsageKwh?: number | null;
  /** 明細の検針月(1-12) */
  usageMonth?: number | null;
  /** 電気料金明細の提出有無。無い場合は定額手数料になる */
  hasStatement?: boolean;
  /** マッチング確認案件（業務管理費を手数料と相殺する） */
  isMatchingConfirmed?: boolean;
}

export interface PricedContract extends ContractAmounts {
  basisDate: Date;
  quantity: number;
  hqPricingRuleId: string | null;
  agencyPriceId: string | null;
  usage: EstimatedUsage;
  /** 明細なしのため定額手数料を適用した */
  appliedNoStatementFee: boolean;
}

const ZERO_PRICE: ResolvedPrice = { unitType: 'PER_WATT', unitPrice: 0, rate: null, sourceId: null };

/**
 * 単価マスタを引いて契約金額を算出する（DB 書き込みは行わない）。
 *
 * 使用量ベースの商流（エバーグリーン MPプラン等）では次の順で計算する。
 *
 *   1. 明細の実使用量 × 季節係数[検針月] = 想定使用量(kWh)
 *   2. 想定使用量で階段表を引く            = 代理店への成約事務手数料
 *   3. 業務管理費などを控除                = 代理店支払額
 *   4. 手数料に上乗せ率を適用              = 本部受取額
 *
 * 従来の 円/W 商流では 1・2 が素通りし、これまでどおり quantity × unitPrice になる。
 */
export async function priceContract(input: PriceContractInput): Promise<PricedContract> {
  const lookup: PriceLookup = {
    organizationId: input.organizationId,
    agencyId: input.agencyId,
    productId: input.productId,
    supplierId: input.supplierId ?? null,
    planId: input.planId ?? null,
    basisDate: input.basisDate,
  };

  const [hq, agency, coefficients, policy] = await Promise.all([
    resolveHqReceivePrice(lookup),
    resolveAgencyPayoutPrice(lookup),
    loadSeasonalCoefficients(input.organizationId, input.supplierId ?? null, input.basisDate),
    loadFeePolicy(input.organizationId, input.supplierId ?? null, input.basisDate),
  ]);

  const usage = calcEstimatedUsage({
    actualUsageKwh: input.actualUsageKwh,
    usageMonth: input.usageMonth,
    coefficients: coefficients as SeasonalCoefficientMap,
  });

  const usesTier = agency?.unitType === 'TIERED_BY_USAGE' || hq?.unitType === 'TIERED_BY_USAGE';
  const hasStatement = input.hasStatement ?? true;

  // 明細の写真が無い場合は階段表ではなく定額手数料を適用する（条件表の但し書き）
  const appliedNoStatementFee = usesTier && !hasStatement && policy.noStatementFee > 0;
  const effectiveAgency: ResolvedPrice | null = appliedNoStatementFee
    ? { unitType: 'FIXED', unitPrice: policy.noStatementFee, rate: null, sourceId: agency?.sourceId ?? null }
    : agency;

  // マッチング確認案件は業務管理費を手数料と相殺する
  const deduction = usesTier && input.isMatchingConfirmed ? policy.managementFee : 0;

  const amounts = calcContractAmounts({
    quantity: input.quantity,
    baseAmount: input.baseAmount ?? undefined,
    estimatedUsage: usage.estimatedUsageKwh,
    deduction,
    hq: hq ?? ZERO_PRICE,
    agency: effectiveAgency,
  });

  return {
    ...amounts,
    basisDate: input.basisDate,
    quantity: input.quantity,
    hqPricingRuleId: hq?.sourceId ?? null,
    agencyPriceId: agency?.sourceId ?? null,
    usage,
    appliedNoStatementFee,
  };
}

/**
 * 算出結果を契約行へスナップショット保存し、計算履歴を1行残す。
 *
 * 保存後は単価マスタを改定しても**この契約の金額は変わらない**（§6）。
 * 再計算は明示的な「単価再適用」操作でのみ行い、そのたびに新しい履歴行を追加する。
 */
export async function applyPricingSnapshot(
  db: PrismaLike,
  contractId: string,
  priced: PricedContract,
  options: { reason: string; actorUserId?: string | null },
): Promise<void> {
  await db.contract.update({
    where: { id: contractId },
    data: {
      hqUnitPrice: new Prisma.Decimal(priced.hqUnitPrice),
      agencyUnitPrice: new Prisma.Decimal(priced.agencyUnitPrice),
      hqRevenue: new Prisma.Decimal(priced.hqRevenue),
      agencyPayout: new Prisma.Decimal(priced.agencyPayout),
      hqGrossProfit: new Prisma.Decimal(priced.hqGrossProfit),
      grossMargin: new Prisma.Decimal(priced.grossMargin),
      seasonalCoefficient:
        priced.usage.coefficient === null ? null : new Prisma.Decimal(priced.usage.coefficient),
      estimatedUsageKwh:
        priced.usage.estimatedUsageKwh === null ? null : new Prisma.Decimal(priced.usage.estimatedUsageKwh),
      pricedAt: new Date(),
    },
  });

  await db.contractPricingSnapshot.create({
    data: {
      contractId,
      reason: options.reason,
      basisDate: priced.basisDate,
      quantity: new Prisma.Decimal(priced.quantity),
      hqUnitPrice: new Prisma.Decimal(priced.hqUnitPrice),
      agencyUnitPrice: new Prisma.Decimal(priced.agencyUnitPrice),
      hqUnitType: priced.hqUnitType,
      agencyUnitType: priced.agencyUnitType,
      hqRevenue: new Prisma.Decimal(priced.hqRevenue),
      agencyPayout: new Prisma.Decimal(priced.agencyPayout),
      hqGrossProfit: new Prisma.Decimal(priced.hqGrossProfit),
      grossMargin: new Prisma.Decimal(priced.grossMargin),
      hqPricingRuleId: priced.hqPricingRuleId,
      agencyPriceId: priced.agencyPriceId,
      actualUsageKwh:
        priced.usage.actualUsageKwh === null ? null : new Prisma.Decimal(priced.usage.actualUsageKwh),
      usageMonth: priced.usage.usageMonth,
      seasonalCoefficient:
        priced.usage.coefficient === null ? null : new Prisma.Decimal(priced.usage.coefficient),
      estimatedUsageKwh:
        priced.usage.estimatedUsageKwh === null ? null : new Prisma.Decimal(priced.usage.estimatedUsageKwh),
      hqTierId: priced.hqTierId,
      agencyTierId: priced.agencyTierId,
      deductionAmount: new Prisma.Decimal(priced.deduction),
      createdById: options.actorUserId ?? null,
    },
  });
}

export { prisma };
