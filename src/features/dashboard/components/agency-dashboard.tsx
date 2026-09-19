import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { StatCard, StatGrid } from '@/components/data/stat-card';
import { formatInt, formatPercent, formatWatt, formatYen } from '@/lib/format';
import type { DashboardData } from '@/server/services/dashboard';
import { MonthlyContractsChart } from './monthly-chart';

/**
 * 代理店ダッシュボード（§17）。
 * VIRTUE 本部の売上単価・粗利・粗利率は**表示禁止**。
 * サーバー側でもそれらのフィールドは返していない（showsHqFinancials = false）。
 */
export function AgencyDashboard({ data, agencyName }: { data: DashboardData; agencyName: string | null }) {
  const { kpi } = data;

  return (
    <>
      <StatGrid columns={6}>
        <StatCard label="自社契約件数" value={formatInt(kpi.totalContracts)} />
        <StatCard label="有効契約件数" value={formatInt(kpi.activeContracts)} />
        <StatCard label="自社ワット数" value={formatWatt(kpi.totalWatt)} />
        <StatCard label="支払予定金額" value={formatYen(kpi.agencyPayout)} tone="positive" />
        <StatCard label="キャンセル件数" value={formatInt(kpi.cancelledContracts)} tone={kpi.cancelledContracts > 0 ? 'negative' : 'default'} sub={`キャンセル率 ${formatPercent(kpi.cancellationRate)}`} />
        <StatCard label="不備件数" value={formatInt(kpi.defectContracts)} tone={kpi.defectContracts > 0 ? 'warning' : 'default'} />
      </StatGrid>

      <Panel>
        <PanelHeader title="契約推移" description={agencyName ? `${agencyName} の月別契約件数` : '月別契約件数'} />
        <PanelBody className="pr-2">
          <MonthlyContractsChart data={data.monthly} />
        </PanelBody>
      </Panel>

      <Panel>
        <PanelHeader title="支払予定サマリ" description="確定額は月次精算で確定します。キャンセル分は控除されます。" />
        <PanelBody>
          <dl className="divide-y divide-[var(--color-border)] text-[13px]">
            <div className="flex items-center justify-between py-2">
              <dt className="text-[var(--color-ink-muted)]">有効契約件数</dt>
              <dd className="num">{formatInt(kpi.activeContracts)}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-[var(--color-ink-muted)]">対象ワット数</dt>
              <dd className="num">{formatWatt(kpi.totalWatt)}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-[var(--color-ink-muted)]">支払予定金額</dt>
              <dd className="num font-semibold">{formatYen(kpi.agencyPayout)}</dd>
            </div>
            <div className="flex items-center justify-between py-2">
              <dt className="text-[var(--color-ink-muted)]">平均契約W</dt>
              <dd className="num">{formatWatt(kpi.averageWatt)}</dd>
            </div>
          </dl>
        </PanelBody>
      </Panel>
    </>
  );
}
