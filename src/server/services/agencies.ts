import { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { orgScope } from '@/server/authz/scope';
import { recordAudit, type AuditRequestInfo } from '@/server/services/audit';
import { DomainError } from '@/lib/errors';
import { toNumber } from '@/lib/money';

export interface AgencyWriteInput {
  code: string;
  name: string;
  corporateName?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  postalCode?: string | null;
  prefecture?: string | null;
  city?: string | null;
  address?: string | null;
  building?: string | null;
  contractStartDate?: Date | null;
  contractEndDate?: Date | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  paymentTerms?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  notes?: string | null;
}

function snapshotOf(agency: {
  code: string;
  name: string;
  corporateName: string | null;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  paymentTerms: string | null;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
}): Prisma.InputJsonValue {
  return {
    code: agency.code,
    name: agency.name,
    corporateName: agency.corporateName,
    contactPerson: agency.contactPerson,
    phone: agency.phone,
    email: agency.email,
    status: agency.status,
    paymentTerms: agency.paymentTerms,
    contractStartDate: agency.contractStartDate?.toISOString() ?? null,
    contractEndDate: agency.contractEndDate?.toISOString() ?? null,
  };
}

function toData(input: Partial<AgencyWriteInput>) {
  return {
    code: input.code?.trim(),
    name: input.name?.trim(),
    corporateName: input.corporateName === undefined ? undefined : (input.corporateName?.trim() || null),
    contactPerson: input.contactPerson === undefined ? undefined : (input.contactPerson?.trim() || null),
    phone: input.phone === undefined ? undefined : (input.phone?.trim() || null),
    email: input.email === undefined ? undefined : (input.email?.trim() || null),
    postalCode: input.postalCode === undefined ? undefined : (input.postalCode?.trim() || null),
    prefecture: input.prefecture === undefined ? undefined : (input.prefecture?.trim() || null),
    city: input.city === undefined ? undefined : (input.city?.trim() || null),
    address: input.address === undefined ? undefined : (input.address?.trim() || null),
    building: input.building === undefined ? undefined : (input.building?.trim() || null),
    contractStartDate: input.contractStartDate === undefined ? undefined : input.contractStartDate,
    contractEndDate: input.contractEndDate === undefined ? undefined : input.contractEndDate,
    status: input.status,
    paymentTerms: input.paymentTerms === undefined ? undefined : (input.paymentTerms?.trim() || null),
    bankName: input.bankName === undefined ? undefined : (input.bankName?.trim() || null),
    bankBranch: input.bankBranch === undefined ? undefined : (input.bankBranch?.trim() || null),
    bankAccountType: input.bankAccountType === undefined ? undefined : (input.bankAccountType?.trim() || null),
    bankAccountNumber: input.bankAccountNumber === undefined ? undefined : (input.bankAccountNumber?.trim() || null),
    bankAccountHolder: input.bankAccountHolder === undefined ? undefined : (input.bankAccountHolder?.trim() || null),
    notes: input.notes === undefined ? undefined : (input.notes?.trim() || null),
  };
}

export async function createAgency(ctx: AccessContext, input: AgencyWriteInput, request?: AuditRequestInfo) {
  const scope = orgScope(ctx);
  const organizationId = scope.organizationId ?? ctx.organizationId;
  if (!organizationId) throw new DomainError('組織が特定できないため代理店を作成できません。');

  const duplicate = await prisma.agency.findFirst({
    where: { organizationId, code: input.code.trim() },
    select: { id: true },
  });
  if (duplicate) throw new DomainError(`代理店コード ${input.code} は既に使用されています。`);

  const data = toData(input);
  const agency = await prisma.agency.create({
    data: {
      organizationId,
      code: data.code ?? input.code,
      name: data.name ?? input.name,
      corporateName: data.corporateName ?? null,
      contactPerson: data.contactPerson ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      postalCode: data.postalCode ?? null,
      prefecture: data.prefecture ?? null,
      city: data.city ?? null,
      address: data.address ?? null,
      building: data.building ?? null,
      contractStartDate: data.contractStartDate ?? null,
      contractEndDate: data.contractEndDate ?? null,
      status: input.status,
      paymentTerms: data.paymentTerms ?? null,
      bankName: data.bankName ?? null,
      bankBranch: data.bankBranch ?? null,
      bankAccountType: data.bankAccountType ?? null,
      bankAccountNumber: data.bankAccountNumber ?? null,
      bankAccountHolder: data.bankAccountHolder ?? null,
      notes: data.notes ?? null,
    },
  });

  await recordAudit(ctx, {
    action: 'agency.create',
    entity: 'agency',
    entityId: agency.id,
    before: null,
    after: snapshotOf(agency),
    ...request,
  });

  return agency;
}

export async function updateAgency(
  ctx: AccessContext,
  id: string,
  input: Partial<AgencyWriteInput>,
  request?: AuditRequestInfo,
) {
  const scope = orgScope(ctx);
  const before = await prisma.agency.findFirst({
    where: { AND: [{ deletedAt: null }, scope.organizationId ? { organizationId: scope.organizationId } : {}, { id }] },
  });
  if (!before) return null;

  if (input.code && input.code.trim() !== before.code) {
    const duplicate = await prisma.agency.findFirst({
      where: { organizationId: before.organizationId, code: input.code.trim(), NOT: { id } },
      select: { id: true },
    });
    if (duplicate) throw new DomainError(`代理店コード ${input.code} は既に使用されています。`);
  }

  const after = await prisma.agency.update({ where: { id }, data: toData(input) });

  await recordAudit(ctx, {
    action: 'agency.update',
    entity: 'agency',
    entityId: id,
    before: snapshotOf(before),
    after: snapshotOf(after),
    ...request,
  });

  return { before, after };
}

export interface AgencyUnitPriceInput {
  agencyId: string;
  productId?: string | null;
  unitType: 'PER_WATT' | 'PER_CONTRACT' | 'PERCENT_OF_AMOUNT' | 'FIXED';
  unitPrice: number;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  note?: string | null;
}

/**
 * 代理店単価を追加する（§5）。
 *
 * 適用期間が重なる既存単価があれば、新しい単価の開始日前日で自動的に締める。
 * **過去契約の金額はスナップショット済みのため、この操作では一切変わらない。**
 */
export async function addAgencyUnitPrice(ctx: AccessContext, input: AgencyUnitPriceInput, request?: AuditRequestInfo) {
  const scope = orgScope(ctx);
  const agency = await prisma.agency.findFirst({
    where: { AND: [scope.organizationId ? { organizationId: scope.organizationId } : {}, { id: input.agencyId }] },
    select: { id: true },
  });
  if (!agency) throw new DomainError('代理店が見つかりません。');

  if (input.effectiveTo && input.effectiveTo < input.effectiveFrom) {
    throw new DomainError('適用終了日は適用開始日以降にしてください。');
  }

  const result = await prisma.$transaction(async (tx) => {
    // 期間が重なる「現行」単価を新単価の前日で締める
    const openEnded = await tx.agencyUnitPrice.findMany({
      where: {
        agencyId: input.agencyId,
        productId: input.productId ?? null,
        effectiveFrom: { lt: input.effectiveFrom },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: input.effectiveFrom } }],
      },
    });
    const closeAt = new Date(input.effectiveFrom);
    closeAt.setDate(closeAt.getDate() - 1);
    for (const row of openEnded) {
      await tx.agencyUnitPrice.update({ where: { id: row.id }, data: { effectiveTo: closeAt } });
    }

    return tx.agencyUnitPrice.create({
      data: {
        agencyId: input.agencyId,
        productId: input.productId || null,
        unitType: input.unitType,
        unitPrice: new Prisma.Decimal(input.unitPrice),
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo ?? null,
        note: input.note?.trim() || null,
        createdById: ctx.userId,
      },
    });
  });

  // 単価変更は財務データ変更として変更前後を残す（§27）
  await recordAudit(ctx, {
    action: 'pricing.create',
    entity: 'agency_unit_price',
    entityId: result.id,
    before: null,
    after: {
      agencyId: input.agencyId,
      productId: input.productId ?? null,
      unitType: input.unitType,
      unitPrice: toNumber(result.unitPrice),
      effectiveFrom: input.effectiveFrom.toISOString(),
      effectiveTo: input.effectiveTo?.toISOString() ?? null,
    },
    ...request,
  });

  return result;
}
