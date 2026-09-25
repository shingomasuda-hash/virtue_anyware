import { DealCompensationPage } from '@/features/deals/deal-compensation-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

/** 報酬は本部管理者のみ（§17 / docs/15_DEAL_MANAGEMENT.md 15.5）。 */
export default async function EditDealCompensationPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'deal:compensation');
  const { id } = await params;
  return <DealCompensationPage ctx={ctx} dealId={id} basePath="/deals" />;
}
