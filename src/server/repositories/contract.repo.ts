import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { agencyScope } from '@/server/authz/scope';

export interface ContractListFilter {
  keyword?: string;
  agencyId?: string;
  statusId?: string;
  productId?: string;
  eventId?: string;
  staffId?: string;
  contractedFrom?: Date;
  contractedTo?: Date;
  includeCancelled?: boolean;
  page?: number;
  pageSize?: number;
}

export function contractScopeWhere(ctx: AccessContext): Prisma.ContractWhereInput {
  const scope = agencyScope(ctx);
  const where: Prisma.ContractWhereInput = { deletedAt: null };
  if (scope.organizationId) where.organizationId = scope.organizationId;
  if (scope.agencyId) where.agencyId = scope.agencyId;
  return where;
}

function buildWhere(ctx: AccessContext, filter: ContractListFilter): Prisma.ContractWhereInput {
  const where = contractScopeWhere(ctx);
  const and: Prisma.ContractWhereInput[] = [];

  if (filter.keyword) {
    and.push({
      OR: [
        { contractNumber: { contains: filter.keyword, mode: 'insensitive' } },
        { customer: { name: { contains: filter.keyword, mode: 'insensitive' } } },
      ],
    });
  }
  if (filter.agencyId) and.push({ agencyId: filter.agencyId });
  if (filter.statusId) and.push({ statusId: filter.statusId });
  if (filter.productId) and.push({ productId: filter.productId });
  if (filter.eventId) and.push({ eventId: filter.eventId });
  if (filter.staffId) and.push({ staffId: filter.staffId });
  if (filter.includeCancelled === false) and.push({ status: { isCancelled: false } });
  if (filter.contractedFrom || filter.contractedTo) {
    and.push({
      contractedAt: {
        ...(filter.contractedFrom ? { gte: filter.contractedFrom } : {}),
        ...(filter.contractedTo ? { lte: filter.contractedTo } : {}),
      },
    });
  }

  if (and.length > 0) where.AND = and;
  return where;
}

export async function listContracts(ctx: AccessContext, filter: ContractListFilter = {}) {
  const where = buildWhere(ctx, filter);
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? 50));

  const [items, total] = await Promise.all([
    prisma.contract.findMany({
      where,
      orderBy: [{ contractedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        customer: { select: { id: true, name: true, phone: true, prefecture: true } },
        agency: { select: { id: true, name: true, code: true } },
        status: true,
        product: { select: { id: true, name: true, category: true } },
        supplier: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
        event: { select: { id: true, name: true } },
        staff: { select: { id: true, name: true } },
      },
    }),
    prisma.contract.count({ where }),
  ]);

  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function findContractById(ctx: AccessContext, id: string) {
  return prisma.contract.findFirst({
    where: { ...contractScopeWhere(ctx), id },
    include: {
      customer: true,
      agency: { select: { id: true, name: true, code: true } },
      status: true,
      product: true,
      supplier: true,
      plan: true,
      event: { select: { id: true, name: true, startDate: true } },
      booth: { select: { id: true, code: true, areaName: true } },
      staff: { select: { id: true, name: true } },
      pricingSnapshots: { orderBy: [{ createdAt: 'desc' }] },
    },
  });
}

/** 集計用の最小取得。KPI 計算は definitions.ts に集約する。 */
export async function findContractFacts(ctx: AccessContext, filter: ContractListFilter = {}) {
  return prisma.contract.findMany({
    where: buildWhere(ctx, filter),
    select: {
      id: true,
      agencyId: true,
      eventId: true,
      staffId: true,
      productId: true,
      contractedAt: true,
      activatedAt: true,
      contractWatt: true,
      hqRevenue: true,
      agencyPayout: true,
      hqGrossProfit: true,
      status: { select: { isCancelled: true, isDefect: true, isActiveContract: true } },
      agency: { select: { id: true, name: true, code: true } },
    },
  });
}
