import Link from 'next/link';
import { PageHeader } from '@/components/data/page-header';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { StatCard, StatGrid } from '@/components/data/stat-card';
import { can, isAgencyScoped, type AccessContext } from '@/server/authz/context';
import { aggregateDealKpi, getDealFormOptions, listDeals, startOfToday } from '@/server/services/deals/repo';
import { formatInt, formatYen } from '@/lib/format';
import type { DealProductType, DealStage } from '@/generated/prisma';
import { DealFilters, type DealFilterValues } from './components/deal-filters';
import { DealTable, type DealRow } from './components/deal-table';

export type DealSearchParams = Partial<
  Record<'q' | 'statusId' | 'productType' | 'agencyId' | 'closerStaffId' | 'open' | 'overdue' | 'stage', string>
>;

const PRODUCT_TYPES: readonly string[] = ['PV', 'BT', 'EQ', 'IH'];

export async function DealListPage({
  ctx,
  searchParams,
  basePath,
  customerBasePath,
  pipelinePath,
}: {
  ctx: AccessContext;
  searchParams: DealSearchParams;
  basePath: string;
  customerBasePath: string;
  /** ファネル画面へのリンク。用意していない画面では省略する。 */
  pipelinePath?: string;
}) {
  const showAgency = !isAgencyScoped(ctx);
  const productType = PRODUCT_TYPES.includes(searchParams.productType ?? '')
    ? (searchParams.productType as DealProductType)
    : undefined;

  const [deals, options, kpi] = await Promise.all([
    listDeals(ctx, {
      keyword: searchParams.q || undefined,
      statusId: searchParams.statusId || undefined,
      stage: (searchParams.stage as DealStage | undefined) || undefined,
      productType,
      agencyId: searchParams.agencyId || undefined,
      closerStaffId: searchParams.closerStaffId || undefined,
      onlyOpen: searchParams.open === '1',
      overdueAction: searchParams.overdue === '1',
    }),
    getDealFormOptions(ctx),
    aggregateDealKpi(ctx),
  ]);

  const rows: DealRow[] = deals.map((d) => ({
    id: d.id,
    code: d.code,
    customerId: d.customerId,
    customerName: d.customer.name,
    statusLabel: d.status.label,
    statusColor: d.status.color,
    productTypes: d.productTypes,
    agencyName: d.agency?.name ?? null,
    closerName: d.closer?.name ?? null,
    metAt: d.metAt,
    contractedAt: d.contractedAt,
    salesPriceExclTax: d.salesPriceExclTax === null ? null : Number(d.salesPriceExclTax),
    nextActionAt: d.nextActionAt,
    priority: d.priority,
  }));

  const initial: DealFilterValues = {
    q: searchParams.q ?? '',
    statusId: searchParams.statusId ?? '',
    productType: searchParams.productType ?? '',
    agencyId: searchParams.agencyId ?? '',
    closerStaffId: searchParams.closerStaffId ?? '',
    open: searchParams.open ?? '',
    overdue: searchParams.overdue ?? '',
  };

  return (
    <>
      <PageHeader
        title="案件（太陽光・蓄電池）"
        description={
          showAgency
            ? 'アポ取得から完工までの案件を管理します。金額は案件ごとの販売価格（税抜）です。'
            : '自社案件のみ表示しています。原価・粗利は表示されません。'
        }
        actions={
          <div className="flex items-center gap-2">
            {pipelinePath ? (
              <Button asChild variant="secondary" size="md">
                <Link href={pipelinePath}>ファネル</Link>
              </Button>
            ) : null}
            {can(ctx, 'deal:write') ? (
              <Button asChild variant="primary" size="md">
                <Link href={`${basePath}/new`}>案件を登録</Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="進行中案件" value={formatInt(kpi.openDeals)} sub={`総案件 ${formatInt(rows.length)} 件（絞り込み後）`} />
        <StatCard label="今月の契約件数" value={formatInt(kpi.monthlyContracts)} />
        <StatCard label="今月の契約売上" value={formatYen(kpi.monthlySales)} sub="販売価格（税抜）の合計" />
        {kpi.totalGrossProfit === null ? (
          <StatCard label="工事待ち" value={formatInt(kpi.constructionPending)} tone={kpi.constructionPending > 0 ? 'warning' : 'default'} />
        ) : (
          <StatCard label="営業利益合計" value={formatYen(kpi.totalGrossProfit)} sub="販売価格 − 原価" />
        )}
      </StatGrid>

      <StatGrid columns={3}>
        <StatCard
          label="次回アクション超過"
          value={formatInt(kpi.overdueActions)}
          tone={kpi.overdueActions > 0 ? 'negative' : 'default'}
          sub="進行中かつ次回アクション日を過ぎている案件"
        />
        <StatCard
          label="入金期限超過"
          value={formatInt(kpi.overduePayments)}
          tone={kpi.overduePayments > 0 ? 'negative' : 'default'}
        />
        <StatCard
          label="工事待ち"
          value={formatInt(kpi.constructionPending)}
          tone={kpi.constructionPending > 0 ? 'warning' : 'default'}
        />
      </StatGrid>

      <Panel>
        <PanelHeader title={`案件一覧（${rows.length} 件）`} />
        <DealFilters
          initial={initial}
          statuses={options.statuses.map((s) => ({ value: s.id, label: s.label }))}
          agencies={options.agencies.map((a) => ({ value: a.id, label: a.name }))}
          closers={options.staff.map((s) => ({ value: s.id, label: s.name }))}
          showAgencyFilter={showAgency}
        />
        <DealTable
          rows={rows}
          basePath={basePath}
          customerBasePath={customerBasePath}
          showAgency={showAgency}
          today={startOfToday()}
        />
      </Panel>
    </>
  );
}
