import { DealFormPage } from '@/features/deals/deal-form-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function NewDealPage() {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'deal:write');
  return <DealFormPage ctx={ctx} basePath="/deals" />;
}
