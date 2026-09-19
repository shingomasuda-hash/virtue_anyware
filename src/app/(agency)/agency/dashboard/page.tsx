import { PageHeader } from '@/components/data/page-header';
import { PeriodSelector } from '@/features/dashboard/components/period-selector';
import { AgencyDashboard } from '@/features/dashboard/components/agency-dashboard';
import { requireAgencyContext } from '@/server/auth/guard';
import { getDashboardData } from '@/server/services/dashboard';
import { resolvePeriod, type PeriodPreset } from '@/lib/date';

const PRESETS = new Set(['today', 'this_month', 'last_month', 'this_quarter', 'this_year']);

export default async function AgencyDashboardPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { ctx, agencyName } = await requireAgencyContext();

  const params = await searchParams;
  const preset: PeriodPreset = PRESETS.has(params.period ?? '') ? (params.period as PeriodPreset) : 'this_month';
  const data = await getDashboardData(ctx, resolvePeriod(preset));

  return (
    <>
      <PageHeader
        title="ダッシュボード"
        description="自社の契約実績と支払予定金額を表示します。"
        actions={<PeriodSelector current={preset} />}
      />
      <AgencyDashboard data={data} agencyName={agencyName} />
    </>
  );
}
