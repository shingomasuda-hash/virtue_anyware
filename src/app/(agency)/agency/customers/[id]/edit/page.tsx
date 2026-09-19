import { CustomerFormPage } from '@/features/customers/customer-form-page';
import { requireAgencyContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function EditAgencyCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireAgencyContext();
  requirePermission(ctx, 'customer:write');
  const { id } = await params;
  return <CustomerFormPage ctx={ctx} customerId={id} basePath="/agency/customers" />;
}
