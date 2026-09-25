import { DealPipelinePage } from '@/features/deals/deal-pipeline-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function HqDealPipelinePage() {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'deal:read');
  return <DealPipelinePage ctx={ctx} />;
}
