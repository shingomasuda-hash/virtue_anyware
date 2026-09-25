import { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { resolveWritableAgencyId, orgScope } from '@/server/authz/scope';
import { contractScopeWhere } from '@/server/repositories/contract.repo';
import { customerScopeWhere } from '@/server/repositories/customer.repo';
import { applyPricingSnapshot, priceContract, type PrismaLike } from '@/server/services/pricing/snapshot';
import { recordAudit, type AuditRequestInfo } from '@/server/services/audit';
import { DomainError } from '@/lib/errors';
import { toNumber } from '@/lib/money';

export interface ContractWriteInput {
  customerId: string;
  productId: string;
  agencyId?: string | null;
  contractNumber?: string | null;
  supplierId?: string | null;
  planId?: string | null;
  contractWatt: number;
  baseAmount?: number | null;
  /** 電気料金明細の実使用量(kWh)。階段表方式の算定に使う */
  actualUsageKwh?: number | null;
  /** 明細の検針月(1-12) */
  usageMonth?: number | null;
  /** 明細の提出有無。無い場合は定額手数料になる */
  hasStatement?: boolean;
  /** マッチング確認案件（業務管理費を相殺する） */
  isMatchingConfirmed?: boolean;
  /** 電気料金明細の請求金額（円）。手数料算定には使わず、使用量との突合に使う */
  usageAmountYen?: number | null;
  /** マッチング完了日 / マッチング月（YYYYMM） */
  matchedAt?: Date | null;
  matchingMonth?: number | null;
  /** 運用ステータス（取りうる値が未確定のため生の文言を保持する。ASSUMPTIONS E-2） */
  documentMailStatus?: string | null;
  followUpStatus?: string | null;
  areaName?: string | null;
  paymentMethodLabel?: string | null;
  statusId: string;
  appliedAt?: Date | null;
  contractedAt?: Date | null;
  activatedAt?: Date | null;
  eventId?: string | null;
  boothId?: string | null;
  staffId?: string | null;
  campaign?: string | null;
  notes?: string | null;
}

/** 監査ログ用の財務スナップショット。金額変更は必ず before/after を残す（§27）。 */
function financialSnapshot(contract: {
  contractNumber: string | null;
  statusId: string;
  contractWatt: Prisma.Decimal | number;
  hqUnitPrice: Prisma.Decimal | number;
  agencyUnitPrice: Prisma.Decimal | number;
  hqRevenue: Prisma.Decimal | number;
  agencyPayout: Prisma.Decimal | number;
  hqGrossProfit: Prisma.Decimal | number;
  grossMargin: Prisma.Decimal | number;
  agencyId: string | null;
  contractedAt: Date | null;
  activatedAt: Date | null;
  cancelledAt: Date | null;
}): Prisma.InputJsonValue {
  return {
    contractNumber: contract.contractNumber,
    statusId: contract.statusId,
    agencyId: contract.agencyId,
    contractWatt: toNumber(contract.contractWatt),
    hqUnitPrice: toNumber(contract.hqUnitPrice),
    agencyUnitPrice: toNumber(contract.agencyUnitPrice),
    hqRevenue: toNumber(contract.hqRevenue),
    agencyPayout: toNumber(contract.agencyPayout),
    hqGrossProfit: toNumber(contract.hqGrossProfit),
    grossMargin: toNumber(contract.grossMargin),
    contractedAt: contract.contractedAt?.toISOString() ?? null,
    activatedAt: contract.activatedAt?.toISOString() ?? null,
    cancelledAt: contract.cancelledAt?.toISOString() ?? null,
  };
}

/** 単価の適用基準日: 契約日 → 申込日 → 今日（docs/08 §8.3 / ASSUMPTIONS C-1）。 */
export function resolveBasisDate(input: { contractedAt?: Date | null; appliedAt?: Date | null }): Date {
  return input.contractedAt ?? input.appliedAt ?? new Date();
}

/**
 * 契約を作成し、**その場で単価を解決してスナップショット保存**する。
 *
 * 画面からも CSV 取込からもこの関数を通す。ここが金額確定の唯一の入口であり、
 * 以後に単価マスタを改定しても、この契約の金額は変わらない（§6）。
 */
export async function createContract(
  ctx: AccessContext,
  input: ContractWriteInput,
  options: { db?: PrismaLike; batchId?: string | null; request?: AuditRequestInfo; reason?: string } = {},
) {
  const db = options.db ?? prisma;

  // 顧客がスコープ内に存在することを確認（他代理店の顧客へ契約をぶら下げられない）
  const customer = await db.customer.findFirst({
    where: { AND: [customerScopeWhere(ctx), { id: input.customerId }] },
    select: { id: true, organizationId: true, agencyId: true },
  });
  if (!customer) throw new DomainError('指定された顧客が見つかりません。');

  const organizationId = customer.organizationId;
  const agencyId = resolveWritableAgencyId(ctx, input.agencyId ?? customer.agencyId);
  const basisDate = resolveBasisDate(input);

  if (input.contractNumber) {
    const duplicate = await db.contract.findFirst({
      where: { organizationId, contractNumber: input.contractNumber, deletedAt: null },
      select: { id: true },
    });
    if (duplicate) throw new DomainError(`契約番号 ${input.contractNumber} は既に登録されています。`);
  }

  const priced = await priceContract({
    organizationId,
    agencyId,
    productId: input.productId,
    supplierId: input.supplierId,
    planId: input.planId,
    quantity: input.contractWatt,
    baseAmount: input.baseAmount,
    basisDate,
    actualUsageKwh: input.actualUsageKwh,
    usageMonth: input.usageMonth,
    hasStatement: input.hasStatement,
    isMatchingConfirmed: input.isMatchingConfirmed,
  });

  const contract = await db.contract.create({
    data: {
      organizationId,
      agencyId,
      customerId: customer.id,
      productId: input.productId,
      contractNumber: input.contractNumber?.trim() || null,
      supplierId: input.supplierId || null,
      planId: input.planId || null,
      quantity: new Prisma.Decimal(input.contractWatt),
      contractWatt: new Prisma.Decimal(input.contractWatt),
      baseAmount: input.baseAmount === null || input.baseAmount === undefined ? null : new Prisma.Decimal(input.baseAmount),
      statusId: input.statusId,
      appliedAt: input.appliedAt ?? null,
      contractedAt: input.contractedAt ?? null,
      activatedAt: input.activatedAt ?? null,
      eventId: input.eventId || null,
      boothId: input.boothId || null,
      staffId: input.staffId || null,
      campaign: input.campaign?.trim() || null,
      notes: input.notes?.trim() || null,
      createdByBatchId: options.batchId ?? null,
      // 使用量ベース算定の入力と結果
      actualUsageKwh:
        input.actualUsageKwh === null || input.actualUsageKwh === undefined
          ? null
          : new Prisma.Decimal(input.actualUsageKwh),
      usageMonth: input.usageMonth ?? null,
      hasStatement: input.hasStatement ?? true,
      isMatchingConfirmed: input.isMatchingConfirmed ?? false,
      usageAmountYen:
        input.usageAmountYen === null || input.usageAmountYen === undefined
          ? null
          : new Prisma.Decimal(input.usageAmountYen),
      // 運用管理項目（金額計算には一切使わない）
      matchedAt: input.matchedAt ?? null,
      matchingMonth: input.matchingMonth ?? null,
      documentMailStatus: input.documentMailStatus?.trim() || null,
      followUpStatus: input.followUpStatus?.trim() || null,
      areaName: input.areaName?.trim() || null,
      paymentMethodLabel: input.paymentMethodLabel?.trim() || null,
      seasonalCoefficient:
        priced.usage.coefficient === null ? null : new Prisma.Decimal(priced.usage.coefficient),
      estimatedUsageKwh:
        priced.usage.estimatedUsageKwh === null ? null : new Prisma.Decimal(priced.usage.estimatedUsageKwh),
      // 単価スナップショット
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
      contractId: contract.id,
      reason: options.reason ?? (options.batchId ? 'csv-import' : 'contract-created'),
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
      createdById: ctx.userId,
    },
  });

  await db.customerActivity.create({
    data: {
      organizationId,
      customerId: customer.id,
      contractId: contract.id,
      type: 'CONTRACT_CREATED',
      title: '契約を登録しました',
      body: `${contract.contractNumber ?? '（番号なし）'} / ${input.contractWatt.toLocaleString()}W`,
      actorUserId: ctx.userId,
    },
  });

  await ensureUpsellLeads(db, { organizationId, customerId: customer.id, contractId: contract.id, statusId: input.statusId });

  await recordAudit(ctx, {
    action: 'contract.create',
    entity: 'contract',
    entityId: contract.id,
    before: null,
    after: financialSnapshot(contract),
    ...options.request,
  });

  return contract;
}

/**
 * 契約を更新する。
 *
 * 数量・契約日・代理店・商材が変わった場合のみ単価を再解決する。
 * それ以外（ステータス変更など）ではスナップショットに触れない。
 */
export async function updateContract(
  ctx: AccessContext,
  id: string,
  input: Partial<ContractWriteInput>,
  options: { db?: PrismaLike; batchId?: string | null; request?: AuditRequestInfo } = {},
) {
  const db = options.db ?? prisma;

  const before = await db.contract.findFirst({ where: { AND: [contractScopeWhere(ctx), { id }] } });
  if (!before) return null;

  const agencyId = input.agencyId === undefined ? before.agencyId : resolveWritableAgencyId(ctx, input.agencyId);
  const contractWatt = input.contractWatt ?? toNumber(before.contractWatt);
  const contractedAt = input.contractedAt === undefined ? before.contractedAt : input.contractedAt;
  const appliedAt = input.appliedAt === undefined ? before.appliedAt : input.appliedAt;
  const productId = input.productId ?? before.productId;

  const actualUsageKwh =
    input.actualUsageKwh === undefined
      ? before.actualUsageKwh === null
        ? null
        : toNumber(before.actualUsageKwh)
      : input.actualUsageKwh;
  const usageMonth = input.usageMonth === undefined ? before.usageMonth : input.usageMonth;
  const hasStatement = input.hasStatement === undefined ? before.hasStatement : input.hasStatement;
  const isMatchingConfirmed =
    input.isMatchingConfirmed === undefined ? before.isMatchingConfirmed : input.isMatchingConfirmed;

  const repricingNeeded =
    contractWatt !== toNumber(before.contractWatt) ||
    contractedAt?.getTime() !== before.contractedAt?.getTime() ||
    agencyId !== before.agencyId ||
    productId !== before.productId ||
    // 使用量ベースの算定要素が変われば再計算する
    actualUsageKwh !== (before.actualUsageKwh === null ? null : toNumber(before.actualUsageKwh)) ||
    usageMonth !== before.usageMonth ||
    hasStatement !== before.hasStatement ||
    isMatchingConfirmed !== before.isMatchingConfirmed;

  await db.contract.update({
    where: { id },
    data: {
      agencyId,
      productId,
      contractNumber: input.contractNumber === undefined ? undefined : (input.contractNumber?.trim() || null),
      supplierId: input.supplierId === undefined ? undefined : (input.supplierId || null),
      planId: input.planId === undefined ? undefined : (input.planId || null),
      quantity: input.contractWatt === undefined ? undefined : new Prisma.Decimal(input.contractWatt),
      contractWatt: input.contractWatt === undefined ? undefined : new Prisma.Decimal(input.contractWatt),
      statusId: input.statusId ?? undefined,
      appliedAt: input.appliedAt === undefined ? undefined : input.appliedAt,
      contractedAt: input.contractedAt === undefined ? undefined : input.contractedAt,
      activatedAt: input.activatedAt === undefined ? undefined : input.activatedAt,
      eventId: input.eventId === undefined ? undefined : (input.eventId || null),
      boothId: input.boothId === undefined ? undefined : (input.boothId || null),
      staffId: input.staffId === undefined ? undefined : (input.staffId || null),
      campaign: input.campaign === undefined ? undefined : (input.campaign?.trim() || null),
      notes: input.notes === undefined ? undefined : (input.notes?.trim() || null),
      actualUsageKwh:
        input.actualUsageKwh === undefined
          ? undefined
          : input.actualUsageKwh === null
            ? null
            : new Prisma.Decimal(input.actualUsageKwh),
      usageMonth: input.usageMonth === undefined ? undefined : input.usageMonth,
      hasStatement: input.hasStatement === undefined ? undefined : input.hasStatement,
      isMatchingConfirmed: input.isMatchingConfirmed === undefined ? undefined : input.isMatchingConfirmed,
      usageAmountYen:
        input.usageAmountYen === undefined
          ? undefined
          : input.usageAmountYen === null
            ? null
            : new Prisma.Decimal(input.usageAmountYen),
      matchedAt: input.matchedAt === undefined ? undefined : input.matchedAt,
      matchingMonth: input.matchingMonth === undefined ? undefined : input.matchingMonth,
      documentMailStatus:
        input.documentMailStatus === undefined ? undefined : (input.documentMailStatus?.trim() || null),
      followUpStatus: input.followUpStatus === undefined ? undefined : (input.followUpStatus?.trim() || null),
      areaName: input.areaName === undefined ? undefined : (input.areaName?.trim() || null),
      paymentMethodLabel:
        input.paymentMethodLabel === undefined ? undefined : (input.paymentMethodLabel?.trim() || null),
    },
  });

  if (repricingNeeded) {
    const priced = await priceContract({
      organizationId: before.organizationId,
      agencyId,
      productId,
      supplierId: input.supplierId ?? before.supplierId,
      planId: input.planId ?? before.planId,
      quantity: contractWatt,
      baseAmount: input.baseAmount ?? (before.baseAmount === null ? null : toNumber(before.baseAmount)),
      basisDate: resolveBasisDate({ contractedAt, appliedAt }),
      actualUsageKwh,
      usageMonth,
      hasStatement,
      isMatchingConfirmed,
    });
    await applyPricingSnapshot(db, id, priced, {
      reason: options.batchId ? 'csv-import:reprice' : 'contract-updated',
      actorUserId: ctx.userId,
    });
  }

  const after = await db.contract.findUniqueOrThrow({ where: { id } });

  await db.customerActivity.create({
    data: {
      organizationId: after.organizationId,
      customerId: after.customerId,
      contractId: after.id,
      type: before.statusId !== after.statusId ? 'STATUS_CHANGED' : 'CONTRACT_UPDATED',
      title: before.statusId !== after.statusId ? '契約ステータスを変更しました' : '契約情報を更新しました',
      actorUserId: ctx.userId,
    },
  });

  await recordAudit(ctx, {
    action: 'contract.update',
    entity: 'contract',
    entityId: id,
    before: financialSnapshot(before),
    after: financialSnapshot(after),
    ...options.request,
  });

  return { before, after, repriced: repricingNeeded };
}

/** 契約をキャンセルする。集計からの除外はステータスの `isCancelled` が担う。 */
export async function cancelContract(
  ctx: AccessContext,
  id: string,
  reason: string,
  request?: AuditRequestInfo,
) {
  const before = await prisma.contract.findFirst({ where: { AND: [contractScopeWhere(ctx), { id }] } });
  if (!before) return null;

  const cancelStatus = await prisma.contractStatus.findFirst({
    where: { organizationId: before.organizationId, isCancelled: true, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  if (!cancelStatus) throw new DomainError('キャンセル用の契約ステータスが設定されていません。');

  const after = await prisma.contract.update({
    where: { id },
    data: { statusId: cancelStatus.id, cancelledAt: new Date(), cancelReason: reason },
  });

  await prisma.customerActivity.create({
    data: {
      organizationId: after.organizationId,
      customerId: after.customerId,
      contractId: after.id,
      type: 'CANCELLED',
      title: '契約をキャンセルしました',
      body: reason,
      actorUserId: ctx.userId,
    },
  });

  await recordAudit(ctx, {
    action: 'contract.cancel',
    entity: 'contract',
    entityId: id,
    before: financialSnapshot(before),
    after: financialSnapshot(after),
    ...request,
  });

  return after;
}

/**
 * 明示的な単価再適用。
 * 通常の更新では過去金額を動かさないため、この操作でのみ再計算する（§6）。
 */
export async function repriceContract(ctx: AccessContext, id: string, reason: string, request?: AuditRequestInfo) {
  const before = await prisma.contract.findFirst({ where: { AND: [contractScopeWhere(ctx), { id }] } });
  if (!before) return null;

  const priced = await priceContract({
    organizationId: before.organizationId,
    agencyId: before.agencyId,
    productId: before.productId,
    supplierId: before.supplierId,
    planId: before.planId,
    quantity: toNumber(before.contractWatt),
    baseAmount: before.baseAmount === null ? null : toNumber(before.baseAmount),
    basisDate: resolveBasisDate(before),
    actualUsageKwh: before.actualUsageKwh === null ? null : toNumber(before.actualUsageKwh),
    usageMonth: before.usageMonth,
    hasStatement: before.hasStatement,
    isMatchingConfirmed: before.isMatchingConfirmed,
  });

  await applyPricingSnapshot(prisma, id, priced, { reason, actorUserId: ctx.userId });
  const after = await prisma.contract.findUniqueOrThrow({ where: { id } });

  await recordAudit(ctx, {
    action: 'contract.reprice',
    entity: 'contract',
    entityId: id,
    before: financialSnapshot(before),
    after: financialSnapshot(after),
    ...request,
  });

  return after;
}

/**
 * 電力契約の登録に伴い、アップセル対象リード（太陽光/蓄電池）を自動生成する（§18）。
 * キャンセル済み契約では生成しない。
 */
export async function ensureUpsellLeads(
  db: PrismaLike,
  params: { organizationId: string; customerId: string; contractId: string; statusId: string },
) {
  const status = await db.contractStatus.findUnique({ where: { id: params.statusId }, select: { isCancelled: true } });
  if (status?.isCancelled) return;

  const [products, defaultStatus] = await Promise.all([
    db.product.findMany({ where: { organizationId: params.organizationId, isUpsell: true, isActive: true }, orderBy: { sortOrder: 'asc' }, take: 1 }),
    db.upsellStatus.findFirst({ where: { organizationId: params.organizationId, code: 'NEW' } }),
  ]);
  const product = products[0];
  if (!product || !defaultStatus) return;

  const existing = await db.upsellLead.findFirst({
    where: { customerId: params.customerId, productId: product.id },
    select: { id: true },
  });
  if (existing) return;

  await db.upsellLead.create({
    data: {
      organizationId: params.organizationId,
      customerId: params.customerId,
      productId: product.id,
      sourceContractId: params.contractId,
      statusId: defaultStatus.id,
    },
  });
}

/** 契約登録フォームの選択肢。組織スコープのみで絞る。 */
export async function getContractFormOptions(ctx: AccessContext) {
  const scope = orgScope(ctx);
  const where = scope.organizationId ? { organizationId: scope.organizationId } : {};
  const [products, suppliers, plans, statuses, events, staff] = await Promise.all([
    prisma.product.findMany({ where: { ...where, isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.supplier.findMany({ where, orderBy: { name: 'asc' } }),
    prisma.plan.findMany({ where: { isActive: true, supplier: where }, orderBy: { name: 'asc' } }),
    prisma.contractStatus.findMany({ where: { ...where, isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.event.findMany({ where, orderBy: { startDate: 'desc' }, take: 100 }),
    prisma.staff.findMany({
      where: { ...where, status: 'ACTIVE', ...(ctx.agencyId ? { agencyId: ctx.agencyId } : {}) },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { products, suppliers, plans, statuses, events, staff };
}
