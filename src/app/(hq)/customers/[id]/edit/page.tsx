import { CustomerFormPage } from '@/features/customers/customer-form-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'customer:write');
  const { id } = await params;
  return <CustomerFormPage ctx={ctx} customerId={id} basePath="/customers" />;
}
