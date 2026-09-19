import { Panel, PanelHeader, PanelBody } from '@/components/ui/panel';
import { StatCard, StatGrid } from '@/components/data/stat-card';
import { formatInt, formatPercent, formatWatt, formatYen } from '@/lib/format';
import type { DashboardData } from '@/server/services/dashboard';
import { AgencyRanking } from './agency-ranking';
import { FunnelTable } from './funnel-table';
import { MonthlyContractsChart, MonthlyRevenueChart } from './monthly-chart';

export function HqDashboard({ data }: { data: DashboardData }) {
  const { kpi, upsell } = data;

  return (
    <>
      <StatGrid columns={6}>
        <StatCard label="総契約件数" value={formatInt(kpi.totalContracts)} />
        <StatCard label="有効契約件数" value={formatInt(kpi.activeContracts)} />
        <StatCard label="キャンセル件数" value={formatInt(kpi.cancelledContracts)} tone={kpi.cancelledContracts > 0 ? 'negative' : 'default'} />
        <StatCard label="キャンセル率" value={formatPercent(kpi.cancellationRate)} tone={kpi.cancellationRate > 0.1 ? 'negative' : 'default'} />
        <StatCard label="総ワット数" value={formatWatt(kpi.totalWatt)} />
        <StatCard label="開通率" value={formatPercent(kpi.activationRate)} />
        <StatCard label="VIRTUE売上" value={formatYen(kpi.hqRevenue)} />
        <StatCard label="代理店支払額" value={formatYen(kpi.agencyPayout)} />
        <StatCard label="VIRTUE粗利" value={formatYen(kpi.hqGrossProfit)} tone="positive" />
        <StatCard label="粗利率" value={formatPercent(kpi.grossMargin)} />
        <StatCard label="アップセル対象" value={formatInt(upsell.targetCustomers)} sub={`トスアップ ${formatInt(upsell.tossupCount)} 件`} />
        <StatCard label="太陽光/蓄電池 成約" value={formatInt(upsell.wonCount)} sub={`アップセル率 ${formatPercent(upsell.upsellRate)}`} />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="月別契約件数" description="キャンセルを除いた有効契約" />
          <PanelBody className="pr-2">
            <MonthlyContractsChart data={data.monthly} />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader title="月別 売上 / 代理店支払 / 粗利" description="契約時点の単価スナップショットで集計" />
          <PanelBody className="pr-2">
            <MonthlyRevenueChart data={data.monthly} showHqFinancials={data.showsHqFinancials} />
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="代理店ランキング" description="対象期間の実績を売上順に表示" />
        <AgencyRanking rows={data.agencyRanking} showHqFinancials={data.showsHqFinancials} />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="アップセルファネル" description="電力契約から太陽光/蓄電池成約までの転換率" />
          <FunnelTable steps={data.funnel} />
        </Panel>
        <Panel>
          <PanelHeader title="収益サマリ" description="docs/KPI_DEFINITIONS.md の定義に基づく集計" />
          <PanelBody>
            <dl className="divide-y divide-[var(--color-border)] text-[13px]">
              <Row label="VIRTUE売上（有効契約）" value={formatYen(kpi.hqRevenue)} />
              <Row label="代理店支払（有効契約）" value={formatYen(kpi.agencyPayout)} />
              <Row label="VIRTUE粗利" value={formatYen(kpi.hqGrossProfit)} strong />
              <Row label="粗利率" value={formatPercent(kpi.grossMargin)} />
              <Row label="平均契約単価" value={formatYen(kpi.averageContractValue)} />
              <Row label="平均契約W" value={formatWatt(kpi.averageWatt)} />
              <Row label="不備件数" value={formatInt(kpi.defectContracts)} />
            </dl>
          </PanelBody>
        </Panel>
      </div>
    </>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-[var(--color-ink-muted)]">{label}</dt>
      <dd className={`num ${strong ? 'font-semibold' : ''}`}>{value}</dd>
    </div>
  );
}
