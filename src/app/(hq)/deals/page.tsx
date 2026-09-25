import { DealListPage, type DealSearchParams } from '@/features/deals/deal-list-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function HqDealsPage({ searchParams }: { searchParams: Promise<DealSearchParams> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'deal:read');
  return <DealListPage ctx={ctx} searchParams={await searchParams} basePath="/deals" customerBasePath="/customers" pipelinePath="/deals/pipeline" />;
}
