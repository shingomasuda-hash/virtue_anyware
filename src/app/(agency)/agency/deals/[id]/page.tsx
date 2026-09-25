import { DealDetailPage } from '@/features/deals/deal-detail-page';
import { requireAgencyContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function AgencyDealDetail({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireAgencyContext();
  requirePermission(ctx, 'deal:read');
  const { id } = await params;
  return (
    <DealDetailPage ctx={ctx} id={id} basePath="/agency/deals" customerBasePath="/agency/customers" />
  );
}
