import { DealProgressPage } from '@/features/deals/deal-progress-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function EditDealProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'deal:progress');
  const { id } = await params;
  return <DealProgressPage ctx={ctx} dealId={id} basePath="/deals" />;
}
