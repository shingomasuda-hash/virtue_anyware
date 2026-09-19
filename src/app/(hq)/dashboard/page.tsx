import { PageHeader } from '@/components/data/page-header';
import { PeriodSelector } from '@/features/dashboard/components/period-selector';
import { HqDashboard } from '@/features/dashboard/components/hq-dashboard';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';
import { getDashboardData } from '@/server/services/dashboard';
import { resolvePeriod, type PeriodPreset } from '@/lib/date';

const PRESETS = new Set(['today', 'this_month', 'last_month', 'this_quarter', 'this_year', 'custom']);

export default async function HqDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'report:read');

  const params = await searchParams;
  const preset: PeriodPreset = PRESETS.has(params.period ?? '') ? (params.period as PeriodPreset) : 'this_month';
  const range = resolvePeriod(preset);
  const data = await getDashboardData(ctx, range);

  return (
    <>
      <PageHeader
        title="ダッシュボード"
        description="契約日ベースで集計しています。金額は契約時点の単価スナップショットです。"
        actions={<PeriodSelector current={preset} />}
      />
      <HqDashboard data={data} />
    </>
  );
}
