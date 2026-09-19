import { ContractFormPage } from '@/features/contracts/contract-form-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function NewContractPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'contract:write');
  const { customerId } = await searchParams;
  return <ContractFormPage ctx={ctx} customerId={customerId} basePath="/contracts" />;
}
