import { ContractFormPage } from '@/features/contracts/contract-form-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'contract:write');
  const { id } = await params;
  return <ContractFormPage ctx={ctx} contractId={id} basePath="/contracts" />;
}
