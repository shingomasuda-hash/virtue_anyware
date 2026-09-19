import type { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { agencyScope } from '@/server/authz/scope';

export interface AgencyListFilter {
  keyword?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

/** 代理店スコープ。代理店ユーザーは自社 1 件しか見えない。 */
function scopeWhere(ctx: AccessContext): Prisma.AgencyWhereInput {
  const scope = agencyScope(ctx);
  const where: Prisma.AgencyWhereInput = { deletedAt: null };
  if (scope.organizationId) where.organizationId = scope.organizationId;
  if (scope.agencyId) where.id = scope.agencyId;
  return where;
}

export async function listAgencies(ctx: AccessContext, filter: AgencyListFilter = {}) {
  const where = scopeWhere(ctx);
  if (filter.status) where.status = filter.status;
  if (filter.keyword) {
    where.OR = [
      { name: { contains: filter.keyword, mode: 'insensitive' } },
      { corporateName: { contains: filter.keyword, mode: 'insensitive' } },
      { code: { contains: filter.keyword, mode: 'insensitive' } },
    ];
  }
  return prisma.agency.findMany({
    where,
    orderBy: [{ code: 'asc' }],
    include: { _count: { select: { customers: true, contracts: true, users: true } } },
  });
}

/**
 * findUnique を使わず scope 付き findFirst で取得する（IDOR 対策）。
 *
 * 代理店ロールのスコープは `id = 自代理店` を含むため、`{ ...scope, id }` と
 * スプレッドで書くと **要求された id がスコープを上書きしてしまう**。
 * 必ず AND で合成すること。
 */
function scopedAgencyWhere(ctx: AccessContext, id: string): Prisma.AgencyWhereInput {
  return { AND: [scopeWhere(ctx), { id }] };
}

export async function findAgencyById(ctx: AccessContext, id: string) {
  return prisma.agency.findFirst({
    where: scopedAgencyWhere(ctx, id),
    include: {
      unitPrices: { orderBy: [{ effectiveFrom: 'desc' }], include: { product: true } },
      _count: { select: { customers: true, contracts: true, users: true, staff: true } },
    },
  });
}

export async function listAgencyUnitPrices(ctx: AccessContext, agencyId: string) {
  const agency = await prisma.agency.findFirst({ where: scopedAgencyWhere(ctx, agencyId), select: { id: true } });
  if (!agency) return [];
  return prisma.agencyUnitPrice.findMany({
    where: { agencyId },
    orderBy: [{ effectiveFrom: 'desc' }],
    include: { product: true },
  });
}
