import { ContractListPage, type ContractSearchParams } from '@/features/contracts/contract-list-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function HqContractsPage({ searchParams }: { searchParams: Promise<ContractSearchParams> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'contract:read');
  return <ContractListPage ctx={ctx} searchParams={await searchParams} basePath="/contracts" customerBasePath="/customers" />;
}
