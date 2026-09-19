import Link from 'next/link';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { PageHeader } from '@/components/data/page-header';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/data/pagination';
import { prisma } from '@/server/db';
import { orgScope } from '@/server/authz/scope';
import { can, isAgencyScoped, type AccessContext } from '@/server/authz/context';
import { listCustomers } from '@/server/repositories/customer.repo';
import { listAgencies } from '@/server/repositories/agency.repo';
import { toNumber } from '@/lib/money';
import { parseDateOnly } from '@/lib/date';
import { CustomerFilters, type CustomerFilterValues, type FilterOption } from './components/customer-filters';
import { CustomerTable, type CustomerRow } from './components/customer-table';

export type CustomerSearchParams = Partial<Record<keyof CustomerFilterValues | 'page', string>>;

function readFilters(params: CustomerSearchParams): CustomerFilterValues {
  return {
    name: params.name ?? '',
    phone: params.phone ?? '',
    contractNumber: params.contractNumber ?? '',
    agencyId: params.agencyId ?? '',
    assignedUserId: params.assignedUserId ?? '',
    prefecture: params.prefecture ?? '',
    contractStatusId: params.contractStatusId ?? '',
    upsellStatusId: params.upsellStatusId ?? '',
    contractedFrom: params.contractedFrom ?? '',
    contractedTo: params.contractedTo ?? '',
  };
}

/**
 * 本部 / 代理店で共通の顧客一覧。
 * 表示差分は「代理店列を出すか」「アップセル条件を出すか」のみで、
 * データの絞り込み自体は repository のスコープが強制する。
 */
export async function CustomerListPage({
  ctx,
  searchParams,
  basePath,
}: {
  ctx: AccessContext;
  searchParams: CustomerSearchParams;
  basePath: string;
}) {
  const filters = readFilters(searchParams);
  const page = Number(searchParams.page ?? '1') || 1;
  const scoped = isAgencyScoped(ctx);
  const showUpsell = can(ctx, 'upsell:read');
  const canWrite = can(ctx, 'customer:write');

  const result = await listCustomers(ctx, {
    name: filters.name || undefined,
    phone: filters.phone || undefined,
    contractNumber: filters.contractNumber || undefined,
    agencyId: filters.agencyId || undefined,
    assignedUserId: filters.assignedUserId || undefined,
    prefecture: filters.prefecture || undefined,
    contractStatusId: filters.contractStatusId || undefined,
    upsellStatusId: showUpsell ? filters.upsellStatusId || undefined : undefined,
    contractedFrom: parseDateOnly(filters.contractedFrom) ?? undefined,
    contractedTo: parseDateOnly(filters.contractedTo) ?? undefined,
    page,
  });

  const scope = orgScope(ctx);
  const [agencies, users, contractStatuses, upsellStatuses, prefectureRows] = await Promise.all([
    scoped ? Promise.resolve([]) : listAgencies(ctx),
    prisma.user.findMany({
      where: { ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.contractStatus.findMany({
      where: { ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
    showUpsell
      ? prisma.upsellStatus.findMany({
          where: { ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), isActive: true },
          orderBy: { sortOrder: 'asc' },
        })
      : Promise.resolve([]),
    prisma.customer.findMany({
      where: { ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), ...(scoped && ctx.agencyId ? { agencyId: ctx.agencyId } : {}), prefecture: { not: null } },
      distinct: ['prefecture'],
      select: { prefecture: true },
      orderBy: { prefecture: 'asc' },
    }),
  ]);

  const rows: CustomerRow[] = result.items.map((c) => {
    const latest = c.contracts[0];
    const lead = c.upsellLeads[0];
    return {
      id: c.id,
      name: c.name,
      nameKana: c.nameKana,
      phone: c.phone,
      prefecture: c.prefecture,
      agencyName: c.agency?.name ?? null,
      assigneeName: c.assignedUser?.name ?? null,
      contractCount: c._count.contracts,
      latestContract: latest
        ? {
            contractNumber: latest.contractNumber,
            statusLabel: latest.status.label,
            statusColor: latest.status.color,
            contractedAt: latest.contractedAt,
            watt: toNumber(latest.contractWatt),
          }
        : null,
      upsellStatusLabel: showUpsell ? (lead?.status.label ?? null) : null,
      upsellStatusColor: showUpsell ? (lead?.status.color ?? null) : null,
    };
  });

  const toOptions = (items: Array<{ id: string; name?: string; label?: string; code?: string }>): FilterOption[] =>
    items.map((i) => ({ value: i.id, label: i.label ?? i.name ?? i.id }));

  function buildHref(nextPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    params.set('page', String(nextPage));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <>
      <PageHeader
        title="顧客"
        description="電力契約を獲得した顧客の一覧。複数条件を組み合わせて絞り込めます。"
        actions={
          canWrite ? (
            <Button asChild variant="primary" size="md">
              <Link href={`${basePath}/new`}>顧客を登録</Link>
            </Button>
          ) : null
        }
      />
      <Panel>
        <CustomerFilters
          initial={filters}
          showAgencyFilter={!scoped}
          agencies={toOptions(agencies)}
          users={toOptions(users)}
          prefectures={prefectureRows
            .map((p) => p.prefecture)
            .filter((p): p is string => Boolean(p))
            .map((p) => ({ value: p, label: p }))}
          contractStatuses={contractStatuses.map((s) => ({ value: s.id, label: s.label }))}
          upsellStatuses={upsellStatuses.map((s) => ({ value: s.id, label: s.label }))}
        />
        <PanelHeader title={`検索結果 ${result.total} 件`} />
        <CustomerTable rows={rows} basePath={basePath} showAgency={!scoped} />
        <Pagination page={result.page} pageCount={result.pageCount} total={result.total} buildHref={buildHref} />
      </Panel>
    </>
  );
}
