import { ContractListPage, type ContractSearchParams } from '@/features/contracts/contract-list-page';
import { requireAgencyContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function AgencyContractsPage({ searchParams }: { searchParams: Promise<ContractSearchParams> }) {
  const { ctx } = await requireAgencyContext();
  requirePermission(ctx, 'contract:read');
  return <ContractListPage ctx={ctx} searchParams={await searchParams} basePath="/agency/contracts" customerBasePath="/agency/customers" />;
}
