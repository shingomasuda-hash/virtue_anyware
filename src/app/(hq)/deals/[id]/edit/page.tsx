import { DealFormPage } from '@/features/deals/deal-form-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'deal:write');
  const { id } = await params;
  return <DealFormPage ctx={ctx} dealId={id} basePath="/deals" />;
}
