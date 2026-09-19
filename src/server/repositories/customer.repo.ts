import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { agencyScope } from '@/server/authz/scope';

export interface CustomerListFilter {
  name?: string;
  phone?: string;
  contractNumber?: string;
  agencyId?: string;
  assignedUserId?: string;
  prefecture?: string;
  contractStatusId?: string;
  upsellStatusId?: string;
  contractedFrom?: Date;
  contractedTo?: Date;
  page?: number;
  pageSize?: number;
}

export const DEFAULT_PAGE_SIZE = 50;

/**
 * 顧客のスコープ where。
 * 代理店ユーザーには必ず agencyId = 自社 が AND される（§4）。
 */
export function customerScopeWhere(ctx: AccessContext): Prisma.CustomerWhereInput {
  const scope = agencyScope(ctx);
  const where: Prisma.CustomerWhereInput = { deletedAt: null };
  if (scope.organizationId) where.organizationId = scope.organizationId;
  if (scope.agencyId) where.agencyId = scope.agencyId;
  return where;
}

function buildWhere(ctx: AccessContext, filter: CustomerListFilter): Prisma.CustomerWhereInput {
  const where = customerScopeWhere(ctx);
  const and: Prisma.CustomerWhereInput[] = [];

  if (filter.name) and.push({ OR: [
    { name: { contains: filter.name, mode: 'insensitive' } },
    { nameKana: { contains: filter.name, mode: 'insensitive' } },
  ] });
  if (filter.phone) {
    const digits = filter.phone.replace(/\D/g, '');
    if (digits) and.push({ phoneNormalized: { contains: digits } });
  }
  // 代理店ユーザーが他代理店 ID を指定しても scope の AND が優先されるため漏れない
  if (filter.agencyId) and.push({ agencyId: filter.agencyId });
  if (filter.assignedUserId) and.push({ assignedUserId: filter.assignedUserId });
  if (filter.prefecture) and.push({ prefecture: filter.prefecture });

  const contractFilter: Prisma.ContractWhereInput = { deletedAt: null };
  let hasContractFilter = false;
  if (filter.contractNumber) {
    contractFilter.contractNumber = { contains: filter.contractNumber, mode: 'insensitive' };
    hasContractFilter = true;
  }
  if (filter.contractStatusId) {
    contractFilter.statusId = filter.contractStatusId;
    hasContractFilter = true;
  }
  if (filter.contractedFrom || filter.contractedTo) {
    contractFilter.contractedAt = {
      ...(filter.contractedFrom ? { gte: filter.contractedFrom } : {}),
      ...(filter.contractedTo ? { lte: filter.contractedTo } : {}),
    };
    hasContractFilter = true;
  }
  if (hasContractFilter) and.push({ contracts: { some: contractFilter } });

  if (filter.upsellStatusId) and.push({ upsellLeads: { some: { statusId: filter.upsellStatusId } } });

  if (and.length > 0) where.AND = and;
  return where;
}

export async function listCustomers(ctx: AccessContext, filter: CustomerListFilter = {}) {
  const where = buildWhere(ctx, filter);
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filter.pageSize ?? DEFAULT_PAGE_SIZE));

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        agency: { select: { id: true, name: true, code: true } },
        assignedUser: { select: { id: true, name: true } },
        contracts: {
          where: { deletedAt: null },
          orderBy: [{ contractedAt: 'desc' }],
          take: 1,
          include: { status: true },
        },
        upsellLeads: { include: { status: true, product: true } },
        _count: { select: { contracts: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** 詳細取得。scope 外の ID は null（404 相当）になる。 */
export async function findCustomerById(ctx: AccessContext, id: string) {
  return prisma.customer.findFirst({
    where: { ...customerScopeWhere(ctx), id },
    include: {
      agency: { select: { id: true, name: true, code: true } },
      assignedUser: { select: { id: true, name: true } },
      sourceEvent: { select: { id: true, name: true, startDate: true } },
      contracts: {
        where: { deletedAt: null },
        orderBy: [{ contractedAt: 'desc' }],
        include: {
          status: true,
          product: true,
          supplier: true,
          plan: true,
          agency: { select: { id: true, name: true } },
          event: { select: { id: true, name: true } },
          staff: { select: { id: true, name: true } },
        },
      },
      activities: { orderBy: [{ occurredAt: 'desc' }], take: 100, include: { actor: { select: { id: true, name: true } } } },
      upsellLeads: {
        include: {
          status: true,
          product: true,
          assignedUser: { select: { id: true, name: true } },
          tossups: { include: { partner: true } },
          activities: { orderBy: [{ createdAt: 'desc' }], take: 20, include: { user: { select: { id: true, name: true } } } },
        },
      },
      revenues: { orderBy: [{ recognizedOn: 'desc' }] },
    },
  });
}

export async function countCustomers(ctx: AccessContext, filter: CustomerListFilter = {}): Promise<number> {
  return prisma.customer.count({ where: buildWhere(ctx, filter) });
}
