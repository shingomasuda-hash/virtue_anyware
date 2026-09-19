import type { AccessContext } from '@/server/authz/context';
import { canViewHqFinancials } from '@/server/authz/context';
import { toNumber } from '@/lib/money';
import { findContractById, listContracts, type ContractListFilter } from '@/server/repositories/contract.repo';
import { prisma } from '@/server/db';
import { evaluateClawbackRisk } from '@/server/services/pricing/clawback';

/** 代理店にも返してよい契約情報。 */
export interface ContractBaseDto {
  id: string;
  contractNumber: string | null;
  customerId: string;
  customerName: string;
  agencyId: string | null;
  agencyName: string | null;
  productName: string;
  supplierName: string | null;
  planName: string | null;
  statusCode: string;
  statusLabel: string;
  statusColor: string;
  isCancelled: boolean;
  contractWatt: number;
  contractedAt: Date | null;
  appliedAt: Date | null;
  activatedAt: Date | null;
  eventName: string | null;
  staffName: string | null;
  /** 代理店が自社の受取見込として見てよい金額 */
  agencyUnitPrice: number;
  agencyPayout: number;
}

/** 本部のみが見られる財務フィールド（§17）。 */
export interface ContractHqFinancials {
  hqUnitPrice: number;
  hqRevenue: number;
  hqGrossProfit: number;
  grossMargin: number;
}

export type ContractDto = ContractBaseDto & Partial<ContractHqFinancials>;

type ContractRow = Awaited<ReturnType<typeof listContracts>>['items'][number];

/**
 * 契約行を DTO へ変換する。
 * 本部財務フィールドは **権限が無い場合そもそも付与しない**（UI で隠すのではない）。
 */
export function toContractDto(ctx: AccessContext, row: ContractRow): ContractDto {
  const base: ContractBaseDto = {
    id: row.id,
    contractNumber: row.contractNumber,
    customerId: row.customer.id,
    customerName: row.customer.name,
    agencyId: row.agencyId,
    agencyName: row.agency?.name ?? null,
    productName: row.product.name,
    supplierName: row.supplier?.name ?? null,
    planName: row.plan?.name ?? null,
    statusCode: row.status.code,
    statusLabel: row.status.label,
    statusColor: row.status.color,
    isCancelled: row.status.isCancelled,
    contractWatt: toNumber(row.contractWatt),
    contractedAt: row.contractedAt,
    appliedAt: row.appliedAt,
    activatedAt: row.activatedAt,
    eventName: row.event?.name ?? null,
    staffName: row.staff?.name ?? null,
    agencyUnitPrice: toNumber(row.agencyUnitPrice),
    agencyPayout: toNumber(row.agencyPayout),
  };

  if (!canViewHqFinancials(ctx)) return base;

  return {
    ...base,
    hqUnitPrice: toNumber(row.hqUnitPrice),
    hqRevenue: toNumber(row.hqRevenue),
    hqGrossProfit: toNumber(row.hqGrossProfit),
    grossMargin: toNumber(row.grossMargin),
  };
}

export async function getContractList(ctx: AccessContext, filter: ContractListFilter = {}) {
  const result = await listContracts(ctx, filter);
  return { ...result, items: result.items.map((row) => toContractDto(ctx, row)) };
}

export async function getContractDetail(ctx: AccessContext, id: string) {
  const row = await findContractById(ctx, id);
  if (!row) return null;

  const showHq = canViewHqFinancials(ctx);

  // 手数料の算定根拠（階段表の該当行 / 上乗せ率）を最新スナップショットから引く
  const latestSnapshot = row.pricingSnapshots[0] ?? null;
  const [tier, markupRule] = await Promise.all([
    latestSnapshot?.agencyTierId
      ? prisma.pricingTier.findUnique({ where: { id: latestSnapshot.agencyTierId } })
      : Promise.resolve(null),
    showHq && latestSnapshot?.hqPricingRuleId
      ? prisma.pricingRule.findUnique({ where: { id: latestSnapshot.hqPricingRuleId } })
      : Promise.resolve(null),
  ]);

  const clawbackRisks = evaluateClawbackRisk({
    appliedAt: row.appliedAt,
    activatedAt: row.activatedAt,
    cancelledAt: row.cancelledAt,
    isCancelled: row.status.isCancelled,
  });

  return {
    contract: row,
    clawbackRisks,
    breakdown: {
      actualUsageKwh: row.actualUsageKwh === null ? null : toNumber(row.actualUsageKwh),
      usageMonth: row.usageMonth,
      seasonalCoefficient: row.seasonalCoefficient === null ? null : toNumber(row.seasonalCoefficient),
      estimatedUsageKwh: row.estimatedUsageKwh === null ? null : toNumber(row.estimatedUsageKwh),
      hasStatement: row.hasStatement,
      isMatchingConfirmed: row.isMatchingConfirmed,
      agencyUnitType: latestSnapshot?.agencyUnitType ?? null,
      tier: tier
        ? {
            minValue: toNumber(tier.minValue),
            maxValue: tier.maxValue === null ? null : toNumber(tier.maxValue),
            amount: toNumber(tier.amount),
          }
        : null,
      deduction: latestSnapshot ? toNumber(latestSnapshot.deductionAmount) : 0,
      markupRate: markupRule?.rate === null || markupRule?.rate === undefined ? null : toNumber(markupRule.rate),
    },
    amounts: {
      agencyUnitPrice: toNumber(row.agencyUnitPrice),
      agencyPayout: toNumber(row.agencyPayout),
      ...(showHq
        ? {
            hqUnitPrice: toNumber(row.hqUnitPrice),
            hqRevenue: toNumber(row.hqRevenue),
            hqGrossProfit: toNumber(row.hqGrossProfit),
            grossMargin: toNumber(row.grossMargin),
          }
        : {}),
    },
    /** 代理店には単価履歴（本部単価を含む）を見せない */
    pricingSnapshots: showHq ? row.pricingSnapshots : [],
  };
}
