import { DealListPage, type DealSearchParams } from '@/features/deals/deal-list-page';
import { requireAgencyContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function AgencyDealsPage({ searchParams }: { searchParams: Promise<DealSearchParams> }) {
  const { ctx } = await requireAgencyContext();
  requirePermission(ctx, 'deal:read');
  return (
    <DealListPage
      ctx={ctx}
      searchParams={await searchParams}
      basePath="/agency/deals"
      customerBasePath="/agency/customers"
    />
  );
}
