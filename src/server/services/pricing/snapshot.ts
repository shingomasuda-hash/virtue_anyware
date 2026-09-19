import { Prisma, type PrismaClient } from '@/generated/prisma';
import { toNumber } from '@/lib/money';
import { calcContractAmounts, type ContractAmounts, type ResolvedPrice } from './calc';
import { resolveAgencyPayoutPrice, resolveHqReceivePrice, type PriceLookup } from './resolve';

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
}

export interface PricedContract extends ContractAmounts {
  basisDate: Date;
  quantity: number;
  hqPricingRuleId: string | null;
  agencyPriceId: string | null;
}

const ZERO_PRICE: ResolvedPrice = { unitType: 'PER_WATT', unitPrice: 0, rate: null, sourceId: null };

/** 単価マスタを引いて契約金額を算出する（DB 書き込みは行わない）。 */
export async function priceContract(input: PriceContractInput): Promise<PricedContract> {
  const lookup: PriceLookup = {
    organizationId: input.organizationId,
    agencyId: input.agencyId,
    productId: input.productId,
    supplierId: input.supplierId ?? null,
    planId: input.planId ?? null,
    basisDate: input.basisDate,
  };

  const [hq, agency] = await Promise.all([
    resolveHqReceivePrice(lookup),
    resolveAgencyPayoutPrice(lookup),
  ]);

  const amounts = calcContractAmounts({
    quantity: input.quantity,
    baseAmount: input.baseAmount ?? undefined,
    hq: hq ?? ZERO_PRICE,
    agency,
  });

  return {
    ...amounts,
    basisDate: input.basisDate,
    quantity: input.quantity,
    hqPricingRuleId: hq?.sourceId ?? null,
    agencyPriceId: agency?.sourceId ?? null,
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
      createdById: options.actorUserId ?? null,
    },
  });
}

/** 契約行に保存済みのスナップショット値を数値へ展開する（集計用）。 */
export function readSnapshot(contract: {
  hqUnitPrice: unknown;
  agencyUnitPrice: unknown;
  hqRevenue: unknown;
  agencyPayout: unknown;
  hqGrossProfit: unknown;
  grossMargin: unknown;
}): ContractAmounts {
  return {
    hqUnitPrice: toNumber(contract.hqUnitPrice as never),
    agencyUnitPrice: toNumber(contract.agencyUnitPrice as never),
    hqRevenue: toNumber(contract.hqRevenue as never),
    agencyPayout: toNumber(contract.agencyPayout as never),
    hqGrossProfit: toNumber(contract.hqGrossProfit as never),
    grossMargin: toNumber(contract.grossMargin as never),
    hqUnitType: 'PER_WATT',
    agencyUnitType: 'PER_WATT',
  };
}
