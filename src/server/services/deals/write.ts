import type {
  CompensationPaymentStatus,
  ConstructionState,
  DealPaymentStatus,
  DealPriority,
  DealProductType,
  LoanReviewState,
  PaymentMethod,
  Prisma,
  ProgressState,
  SiteSurveyState,
  SubsidyState,
} from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { agencyScope, orgScope, resolveWritableAgencyId } from '@/server/authz/scope';
import { recordAudit, type AuditRequestInfo } from '@/server/services/audit';
import { DomainError } from '@/lib/errors';
import { calcCompensation } from './compensation';

export interface DealWriteInput {
  code?: string | null;
  customerId: string;
  agencyId?: string | null;
  statusId: string;
  closerStaffId?: string | null;
  appointerStaffId?: string | null;
  productTypes: DealProductType[];
  pvManufacturerId?: string | null;
  pvCapacityKw?: number | null;
  batteryManufacturerId?: string | null;
  batteryModelId?: string | null;
  batteryCapacityKwh?: number | null;
  equipmentManufacturerId?: string | null;
  metAt?: Date | null;
  contractedAt?: Date | null;
  salesPriceExclTax?: number | null;
  paymentMethod?: PaymentMethod | null;
  financeCompanyId?: string | null;
  lostReason?: string | null;
  nextActionAt?: Date | null;
  priority: DealPriority;
  notes?: string | null;
}

export interface DealProgressInput {
  loanReview: LoanReviewState;
  siteSurvey: SiteSurveyState;
  siteSurveyAt?: Date | null;
  subsidy: SubsidyState;
  subsidyProgram?: string | null;
  subsidyAppliedAt?: Date | null;
  subsidyApprovedAt?: Date | null;
  construction: ConstructionState;
  constructionScheduledAt?: Date | null;
  constructionCompletedAt?: Date | null;
  completionCheck: ProgressState;
  paymentDueAt?: Date | null;
  paidAt?: Date | null;
  paymentStatus: DealPaymentStatus;
  contractDocument: ProgressState;
  importantMatters: ProgressState;
  warranty: ProgressState;
  sitePhotos: ProgressState;
  gridConnection: ProgressState;
  attention?: string | null;
}

export interface DealCompensationInput {
  equipmentCost: number;
  constructionCost: number;
  extendedWarrantyCost: number;
  otherCost: number;
  deductionAmount: number;
  salesCommissionRate: number;
  agencyCommissionRate: number;
  paymentDueAt?: Date | null;
  paidAt?: Date | null;
  paymentStatus: CompensationPaymentStatus;
  notes?: string | null;
}

/** 案件の where。読み取りと同じスコープを書き込みでも使う。 */
function dealScopeWhere(ctx: AccessContext): Prisma.DealWhereInput {
  const scope = agencyScope(ctx);
  return {
    ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
    ...(scope.agencyId ? { agencyId: scope.agencyId } : {}),
    deletedAt: null,
  };
}

function resolveOrganizationId(ctx: AccessContext): string {
  const organizationId = orgScope(ctx).organizationId ?? ctx.organizationId;
  if (!organizationId) throw new DomainError('組織が特定できないため案件を登録できません。');
  return organizationId;
}

/** 参照先が同じ組織のものであることを必ず確認する（他組織の ID を送られても通さない）。 */
async function assertSameOrganization(
  organizationId: string,
  refs: {
    statusId?: string | undefined;
    staffIds?: readonly (string | null | undefined)[];
    manufacturerIds?: readonly (string | null | undefined)[];
    batteryModelId?: string | null | undefined;
    financeCompanyId?: string | null | undefined;
  },
): Promise<void> {
  if (refs.statusId) {
    const status = await prisma.dealStatus.findFirst({
      where: { id: refs.statusId, organizationId },
      select: { id: true },
    });
    if (!status) throw new DomainError('指定された案件ステータスが見つかりません。');
  }

  const staffIds = (refs.staffIds ?? []).filter((v): v is string => Boolean(v));
  if (staffIds.length > 0) {
    const count = await prisma.staff.count({ where: { id: { in: staffIds }, organizationId } });
    if (count !== new Set(staffIds).size) throw new DomainError('指定された担当者が見つかりません。');
  }

  const manufacturerIds = (refs.manufacturerIds ?? []).filter((v): v is string => Boolean(v));
  if (manufacturerIds.length > 0) {
    const count = await prisma.manufacturer.count({ where: { id: { in: manufacturerIds }, organizationId } });
    if (count !== new Set(manufacturerIds).size) throw new DomainError('指定されたメーカーが見つかりません。');
  }

  if (refs.batteryModelId) {
    const model = await prisma.equipmentModel.findFirst({
      where: { id: refs.batteryModelId, organizationId },
      select: { id: true },
    });
    if (!model) throw new DomainError('指定された蓄電池の型式が見つかりません。');
  }

  if (refs.financeCompanyId) {
    const partner = await prisma.partner.findFirst({
      where: { id: refs.financeCompanyId, organizationId, kinds: { has: 'FINANCE' } },
      select: { id: true },
    });
    if (!partner) throw new DomainError('指定された信販会社が見つかりません。');
  }
}

/**
 * 顧客が操作者のスコープ内にあることを確認する。
 * 代理店ロールは他代理店の顧客に案件を作れない。
 */
async function assertCustomerInScope(ctx: AccessContext, customerId: string): Promise<void> {
  const scope = agencyScope(ctx);
  const customer = await prisma.customer.findFirst({
    where: {
      AND: [
        scope.organizationId ? { organizationId: scope.organizationId } : {},
        scope.agencyId ? { agencyId: scope.agencyId } : {},
        { id: customerId, deletedAt: null },
      ],
    },
    select: { id: true },
  });
  if (!customer) throw new DomainError('指定された顧客が見つかりません。');
}

/** 案件コードの自動採番（A0001 形式）。手入力があればそれを使う。 */
async function nextDealCode(organizationId: string): Promise<string> {
  const latest = await prisma.deal.findFirst({
    where: { organizationId, code: { startsWith: 'A' } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const current = latest ? Number(latest.code.replace(/^A/, '')) : 0;
  const next = Number.isFinite(current) ? current + 1 : 1;
  return `A${String(next).padStart(4, '0')}`;
}

function snapshotOf(deal: {
  code: string;
  statusId: string;
  agencyId: string | null;
  customerId: string;
  salesPriceExclTax: Prisma.Decimal | null;
  contractedAt: Date | null;
  priority: string;
}): Prisma.InputJsonValue {
  return {
    code: deal.code,
    statusId: deal.statusId,
    agencyId: deal.agencyId,
    customerId: deal.customerId,
    salesPriceExclTax: deal.salesPriceExclTax ? deal.salesPriceExclTax.toString() : null,
    contractedAt: deal.contractedAt?.toISOString() ?? null,
    priority: deal.priority,
  };
}

function toDealData(input: Partial<DealWriteInput>) {
  return {
    statusId: input.statusId,
    closerStaffId: input.closerStaffId === undefined ? undefined : (input.closerStaffId || null),
    appointerStaffId: input.appointerStaffId === undefined ? undefined : (input.appointerStaffId || null),
    productTypes: input.productTypes,
    pvManufacturerId: input.pvManufacturerId === undefined ? undefined : (input.pvManufacturerId || null),
    pvCapacityKw: input.pvCapacityKw === undefined ? undefined : input.pvCapacityKw,
    batteryManufacturerId:
      input.batteryManufacturerId === undefined ? undefined : (input.batteryManufacturerId || null),
    batteryModelId: input.batteryModelId === undefined ? undefined : (input.batteryModelId || null),
    batteryCapacityKwh: input.batteryCapacityKwh === undefined ? undefined : input.batteryCapacityKwh,
    equipmentManufacturerId:
      input.equipmentManufacturerId === undefined ? undefined : (input.equipmentManufacturerId || null),
    metAt: input.metAt === undefined ? undefined : input.metAt,
    contractedAt: input.contractedAt === undefined ? undefined : input.contractedAt,
    salesPriceExclTax: input.salesPriceExclTax === undefined ? undefined : input.salesPriceExclTax,
    paymentMethod: input.paymentMethod === undefined ? undefined : (input.paymentMethod || null),
    financeCompanyId: input.financeCompanyId === undefined ? undefined : (input.financeCompanyId || null),
    lostReason: input.lostReason === undefined ? undefined : (input.lostReason?.trim() || null),
    nextActionAt: input.nextActionAt === undefined ? undefined : input.nextActionAt,
    priority: input.priority,
    notes: input.notes === undefined ? undefined : (input.notes?.trim() || null),
  };
}

export async function createDeal(ctx: AccessContext, input: DealWriteInput, request?: AuditRequestInfo) {
  const organizationId = resolveOrganizationId(ctx);
  const agencyId = resolveWritableAgencyId(ctx, input.agencyId);

  await assertCustomerInScope(ctx, input.customerId);
  await assertSameOrganization(organizationId, {
    statusId: input.statusId,
    staffIds: [input.closerStaffId, input.appointerStaffId],
    manufacturerIds: [input.pvManufacturerId, input.batteryManufacturerId, input.equipmentManufacturerId],
    batteryModelId: input.batteryModelId,
    financeCompanyId: input.financeCompanyId,
  });

  const code = input.code?.trim() || (await nextDealCode(organizationId));
  const duplicate = await prisma.deal.findFirst({
    where: { organizationId, code },
    select: { id: true },
  });
  if (duplicate) throw new DomainError(`案件ID ${code} は既に登録されています。`);

  const deal = await prisma.$transaction(async (tx) => {
    const created = await tx.deal.create({
      data: {
        organizationId,
        agencyId,
        customerId: input.customerId,
        code,
        ...toDealData(input),
        statusId: input.statusId,
        productTypes: input.productTypes,
        priority: input.priority,
      },
    });
    await tx.dealActivity.create({
      data: {
        dealId: created.id,
        type: 'STATUS_CHANGE',
        userId: ctx.userId,
        toStatusId: created.statusId,
        memo: '案件を登録',
      },
    });
    return created;
  });

  await recordAudit(ctx, {
    action: 'deal.create',
    entity: 'deal',
    entityId: deal.id,
    before: null,
    after: snapshotOf(deal),
    ...request,
  });

  return deal;
}

export async function updateDeal(
  ctx: AccessContext,
  id: string,
  input: Partial<DealWriteInput>,
  request?: AuditRequestInfo,
) {
  const before = await prisma.deal.findFirst({ where: { AND: [dealScopeWhere(ctx), { id }] } });
  if (!before) return null;

  const organizationId = before.organizationId;
  if (input.customerId && input.customerId !== before.customerId) {
    await assertCustomerInScope(ctx, input.customerId);
  }
  await assertSameOrganization(organizationId, {
    statusId: input.statusId,
    staffIds: [input.closerStaffId, input.appointerStaffId],
    manufacturerIds: [input.pvManufacturerId, input.batteryManufacturerId, input.equipmentManufacturerId],
    batteryModelId: input.batteryModelId,
    financeCompanyId: input.financeCompanyId,
  });

  // 代理店ロールは自代理店から動かせない
  const agencyId = input.agencyId === undefined ? undefined : resolveWritableAgencyId(ctx, input.agencyId);

  const after = await prisma.$transaction(async (tx) => {
    const updated = await tx.deal.update({
      where: { id },
      data: {
        ...toDealData(input),
        ...(input.customerId ? { customerId: input.customerId } : {}),
        ...(agencyId === undefined ? {} : { agencyId }),
      },
    });
    if (input.statusId && input.statusId !== before.statusId) {
      await tx.dealActivity.create({
        data: {
          dealId: id,
          type: 'STATUS_CHANGE',
          userId: ctx.userId,
          fromStatusId: before.statusId,
          toStatusId: input.statusId,
        },
      });
    }
    return updated;
  });

  await recordAudit(ctx, {
    action: before.statusId === after.statusId ? 'deal.update' : 'deal.status_change',
    entity: 'deal',
    entityId: id,
    before: snapshotOf(before),
    after: snapshotOf(after),
    ...request,
  });

  return { before, after };
}

export async function upsertDealProgress(
  ctx: AccessContext,
  dealId: string,
  input: DealProgressInput,
  request?: AuditRequestInfo,
) {
  const deal = await prisma.deal.findFirst({ where: { AND: [dealScopeWhere(ctx), { id: dealId }] }, select: { id: true } });
  if (!deal) return null;

  const before = await prisma.dealProgress.findUnique({ where: { dealId } });
  const data = {
    loanReview: input.loanReview,
    siteSurvey: input.siteSurvey,
    siteSurveyAt: input.siteSurveyAt ?? null,
    subsidy: input.subsidy,
    subsidyProgram: input.subsidyProgram?.trim() || null,
    subsidyAppliedAt: input.subsidyAppliedAt ?? null,
    subsidyApprovedAt: input.subsidyApprovedAt ?? null,
    construction: input.construction,
    constructionScheduledAt: input.constructionScheduledAt ?? null,
    constructionCompletedAt: input.constructionCompletedAt ?? null,
    completionCheck: input.completionCheck,
    paymentDueAt: input.paymentDueAt ?? null,
    paidAt: input.paidAt ?? null,
    paymentStatus: input.paymentStatus,
    contractDocument: input.contractDocument,
    importantMatters: input.importantMatters,
    warranty: input.warranty,
    sitePhotos: input.sitePhotos,
    gridConnection: input.gridConnection,
    attention: input.attention?.trim() || null,
  };

  const after = await prisma.$transaction(async (tx) => {
    const saved = await tx.dealProgress.upsert({
      where: { dealId },
      create: { dealId, ...data },
      update: data,
    });
    await tx.dealActivity.create({
      data: { dealId, type: 'PROGRESS_UPDATE', userId: ctx.userId, memo: '進捗を更新' },
    });
    return saved;
  });

  await recordAudit(ctx, {
    action: 'deal.progress_update',
    entity: 'deal_progress',
    entityId: dealId,
    before: before ? (JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue) : null,
    after: JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue,
    ...request,
  });

  return after;
}

/**
 * 報酬の保存。金額はここで計算した結果だけを保存し、クライアントから受け取った金額は使わない（§34）。
 */
export async function upsertDealCompensation(
  ctx: AccessContext,
  dealId: string,
  input: DealCompensationInput,
  request?: AuditRequestInfo,
) {
  const deal = await prisma.deal.findFirst({
    where: { AND: [dealScopeWhere(ctx), { id: dealId }] },
    select: { id: true, salesPriceExclTax: true },
  });
  if (!deal) return null;
  if (deal.salesPriceExclTax === null) {
    throw new DomainError('販売価格が未入力のため報酬を計算できません。先に案件の販売価格を入力してください。');
  }

  const result = calcCompensation({
    salesPriceExclTax: deal.salesPriceExclTax,
    equipmentCost: input.equipmentCost,
    constructionCost: input.constructionCost,
    extendedWarrantyCost: input.extendedWarrantyCost,
    otherCost: input.otherCost,
    deductionAmount: input.deductionAmount,
    salesCommissionRate: input.salesCommissionRate,
    agencyCommissionRate: input.agencyCommissionRate,
  });

  const before = await prisma.dealCompensation.findUnique({ where: { dealId } });
  const data = {
    equipmentCost: input.equipmentCost,
    constructionCost: input.constructionCost,
    extendedWarrantyCost: input.extendedWarrantyCost,
    otherCost: input.otherCost,
    deductionAmount: input.deductionAmount,
    salesCommissionRate: input.salesCommissionRate,
    agencyCommissionRate: input.agencyCommissionRate,
    totalCost: result.totalCost,
    grossProfit: result.grossProfit,
    commissionBase: result.commissionBase,
    salesCommission: result.salesCommission,
    agencyCommission: result.agencyCommission,
    companyGrossProfit: result.companyGrossProfit,
    calculatedAt: new Date(),
    paymentDueAt: input.paymentDueAt ?? null,
    paidAt: input.paidAt ?? null,
    paymentStatus: input.paymentStatus,
    notes: input.notes?.trim() || null,
  };

  const after = await prisma.dealCompensation.upsert({
    where: { dealId },
    create: { dealId, ...data },
    update: data,
  });

  await recordAudit(ctx, {
    action: 'deal.compensation_update',
    entity: 'deal_compensation',
    entityId: dealId,
    before: before ? (JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue) : null,
    after: JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue,
    ...request,
  });

  return after;
}
