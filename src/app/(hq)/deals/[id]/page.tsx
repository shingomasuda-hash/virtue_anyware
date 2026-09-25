import { DealDetailPage } from '@/features/deals/deal-detail-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function HqDealDetail({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'deal:read');
  const { id } = await params;
  return <DealDetailPage ctx={ctx} id={id} basePath="/deals" customerBasePath="/customers" />;
}
