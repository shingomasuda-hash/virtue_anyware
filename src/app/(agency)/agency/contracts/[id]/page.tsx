import { ContractDetailPage } from '@/features/contracts/contract-detail-page';
import { requireAgencyContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function AgencyContractDetail({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireAgencyContext();
  requirePermission(ctx, 'contract:read');
  const { id } = await params;
  return <ContractDetailPage ctx={ctx} id={id} customerBasePath="/agency/customers" contractBasePath="/agency/contracts" />;
}
