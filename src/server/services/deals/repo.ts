import type { DealProductType, DealStage, Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db';
import { can, type AccessContext } from '@/server/authz/context';
import { agencyScope, orgScope } from '@/server/authz/scope';

/**
 * 案件の読み取り。すべて `agencyScope(ctx)` を AND する。
 *
 * 代理店ロールの where には必ず `agencyId` が入るため、
 * 自社直販案件（`agencyId = NULL`）は代理店から 1 件も見えない（ASSUMPTIONS D2-3）。
 */

export interface DealListFilter {
  statusId?: string | undefined;
  stage?: DealStage | undefined;
  agencyId?: string | undefined;
  productType?: DealProductType | undefined;
  closerStaffId?: string | undefined;
  keyword?: string | undefined;
  /** 進行中のみ */
  onlyOpen?: boolean | undefined;
  /** 次回アクション日が過ぎている案件のみ */
  overdueAction?: boolean | undefined;
}

/** 日付の 00:00 を返す（期限超過判定の基準）。 */
export function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function monthRange(now: Date = new Date()): { from: Date; to: Date } {
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
}

function dealWhere(ctx: AccessContext, filter: DealListFilter = {}): Prisma.DealWhereInput {
  const scope = agencyScope(ctx);
  const and: Prisma.DealWhereInput[] = [
    {
      ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
      ...(scope.agencyId ? { agencyId: scope.agencyId } : {}),
      deletedAt: null,
    },
  ];

  if (filter.statusId) and.push({ statusId: filter.statusId });
  if (filter.stage) and.push({ status: { stage: filter.stage } });
  // 代理店ロールが他代理店を指定しても scope 側の agencyId と AND されるため 0 件になる
  if (filter.agencyId) and.push({ agencyId: filter.agencyId });
  if (filter.productType) and.push({ productTypes: { has: filter.productType } });
  if (filter.closerStaffId) and.push({ closerStaffId: filter.closerStaffId });
  if (filter.onlyOpen) and.push({ status: { isOpen: true } });
  if (filter.overdueAction) {
    and.push({ nextActionAt: { lt: startOfToday() }, status: { isOpen: true } });
  }
  if (filter.keyword) {
    const keyword = filter.keyword.trim();
    if (keyword) {
      and.push({
        OR: [
          { code: { contains: keyword, mode: 'insensitive' } },
          { customer: { name: { contains: keyword, mode: 'insensitive' } } },
          { customer: { nameKana: { contains: keyword, mode: 'insensitive' } } },
          { customer: { phone: { contains: keyword } } },
        ],
      });
    }
  }

  return { AND: and };
}

const listInclude = {
  status: true,
  agency: { select: { id: true, name: true, code: true } },
  customer: { select: { id: true, name: true, nameKana: true, phone: true, prefecture: true } },
  closer: { select: { id: true, name: true } },
  appointer: { select: { id: true, name: true } },
} satisfies Prisma.DealInclude;

export async function listDeals(ctx: AccessContext, filter: DealListFilter = {}) {
  return prisma.deal.findMany({
    where: dealWhere(ctx, filter),
    include: listInclude,
    orderBy: [{ code: 'asc' }],
  });
}

/**
 * ID 指定の取得。`findUnique` は使わない。
 * URL に他代理店の案件 ID を直接入れても null になる。
 */
export async function findDealById(ctx: AccessContext, id: string) {
  return prisma.deal.findFirst({
    where: { AND: [dealWhere(ctx), { id }] },
    include: {
      ...listInclude,
      pvManufacturer: { select: { id: true, name: true } },
      batteryManufacturer: { select: { id: true, name: true } },
      equipmentManufacturer: { select: { id: true, name: true } },
      batteryModel: { select: { id: true, name: true, capacity: true } },
      financeCompany: { select: { id: true, name: true } },
      progress: true,
      activities: {
        orderBy: { occurredAt: 'desc' },
        take: 50,
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
}

/**
 * 報酬は別権限。`deal:compensation` を持たないロールには取得経路を与えない。
 * 呼び出し側で `requirePermission(ctx, 'deal:compensation')` を先に通すこと。
 */
export async function findDealCompensation(ctx: AccessContext, dealId: string) {
  if (!can(ctx, 'deal:compensation')) return null;
  const deal = await prisma.deal.findFirst({ where: { AND: [dealWhere(ctx), { id: dealId }] }, select: { id: true } });
  if (!deal) return null;
  return prisma.dealCompensation.findUnique({ where: { dealId } });
}

export async function listDealStatuses(ctx: AccessContext) {
  const scope = orgScope(ctx);
  return prisma.dealStatus.findMany({
    where: { ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

/** 案件フォームの選択肢。代理店ロールには自代理店のみ返す。 */
export async function getDealFormOptions(ctx: AccessContext) {
  const scope = agencyScope(ctx);
  const org = scope.organizationId ? { organizationId: scope.organizationId } : {};

  const [statuses, agencies, staff, manufacturers, batteryModels, financeCompanies, customers] = await Promise.all([
    listDealStatuses(ctx),
    prisma.agency.findMany({
      where: { ...org, ...(scope.agencyId ? { id: scope.agencyId } : {}), deletedAt: null },
      orderBy: { code: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    // 営業(CL)・アポ(AP)担当は本部所属（agencyId = NULL）の人もいるため、
    // 代理店ロールには「本部共通の担当者 + 自代理店の担当者」を返す。
    prisma.staff.findMany({
      where: {
        ...org,
        ...(scope.agencyId ? { OR: [{ agencyId: null }, { agencyId: scope.agencyId }] } : {}),
        status: 'ACTIVE',
      },
      orderBy: { code: 'asc' },
      select: { id: true, name: true, code: true },
    }),
    prisma.manufacturer.findMany({
      where: { ...org, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, categories: true },
    }),
    prisma.equipmentModel.findMany({
      where: { ...org, category: 'BATTERY', isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, capacity: true, manufacturerId: true },
    }),
    prisma.partner.findMany({
      where: { ...org, kinds: { has: 'FINANCE' }, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    // 顧客数が増えたら入力方式を検索付きに変える（当面は先頭 500 件のセレクト）
    prisma.customer.findMany({
      where: { ...org, ...(scope.agencyId ? { agencyId: scope.agencyId } : {}), deletedAt: null },
      orderBy: { name: 'asc' },
      take: 500,
      select: { id: true, name: true, phone: true, externalCustomerId: true },
    }),
  ]);

  return { statuses, agencies, staff, manufacturers, batteryModels, financeCompanies, customers };
}

export interface DealKpi {
  totalCustomers: number;
  openDeals: number;
  monthlyContracts: number;
  monthlySales: number;
  /** 営業利益合計。`deal:compensation` が無いロールには null を返す（§17） */
  totalGrossProfit: number | null;
  overdueActions: number;
  overduePayments: number;
  constructionPending: number;
}

/** ダッシュボード用の集計（docs/15_DEAL_MANAGEMENT.md 15.7）。 */
export async function aggregateDealKpi(ctx: AccessContext, now: Date = new Date()): Promise<DealKpi> {
  const { from, to } = monthRange(now);
  const today = startOfToday(now);
  const base = dealWhere(ctx);

  const [customers, openDeals, monthly, overdueActions, overduePayments, constructionPending] = await Promise.all([
    prisma.deal.findMany({ where: base, select: { customerId: true }, distinct: ['customerId'] }),
    prisma.deal.count({ where: { AND: [base, { status: { isOpen: true } }] } }),
    prisma.deal.aggregate({
      where: { AND: [base, { contractedAt: { gte: from, lt: to } }] },
      _count: { _all: true },
      _sum: { salesPriceExclTax: true },
    }),
    prisma.deal.count({
      where: { AND: [base, { nextActionAt: { lt: today } }, { status: { isOpen: true } }] },
    }),
    prisma.deal.count({
      where: {
        AND: [base, { progress: { paymentDueAt: { lt: today }, paymentStatus: { not: 'PAID' } } }],
      },
    }),
    prisma.deal.count({ where: { AND: [base, { status: { code: 'CONSTRUCTION_PENDING' } }] } }),
  ]);

  let totalGrossProfit: number | null = null;
  if (can(ctx, 'deal:compensation')) {
    const compensation = await prisma.dealCompensation.aggregate({
      where: { deal: base },
      _sum: { grossProfit: true },
    });
    totalGrossProfit = Number(compensation._sum.grossProfit ?? 0);
  }

  return {
    totalCustomers: customers.length,
    openDeals,
    monthlyContracts: monthly._count._all,
    monthlySales: Number(monthly._sum.salesPriceExclTax ?? 0),
    totalGrossProfit,
    overdueActions,
    overduePayments,
    constructionPending,
  };
}

export interface PipelineRow {
  statusId: string;
  code: string;
  label: string;
  stage: DealStage;
  color: string;
  count: number;
  amount: number;
}

/** ステータス別の件数と販売価格合計（ファネル）。 */
export async function aggregatePipeline(ctx: AccessContext): Promise<PipelineRow[]> {
  const [statuses, grouped] = await Promise.all([
    listDealStatuses(ctx),
    prisma.deal.groupBy({
      by: ['statusId'],
      where: dealWhere(ctx),
      _count: { _all: true },
      _sum: { salesPriceExclTax: true },
    }),
  ]);

  const byStatus = new Map(grouped.map((g) => [g.statusId, g]));
  return statuses.map((status) => {
    const row = byStatus.get(status.id);
    return {
      statusId: status.id,
      code: status.code,
      label: status.label,
      stage: status.stage,
      color: status.color,
      count: row?._count._all ?? 0,
      amount: Number(row?._sum.salesPriceExclTax ?? 0),
    };
  });
}
