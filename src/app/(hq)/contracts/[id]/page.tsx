import { ContractDetailPage } from '@/features/contracts/contract-detail-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function HqContractDetail({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'contract:read');
  const { id } = await params;
  return <ContractDetailPage ctx={ctx} id={id} customerBasePath="/customers" contractBasePath="/contracts" />;
}
