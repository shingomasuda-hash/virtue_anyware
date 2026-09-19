import { CustomerFormPage } from '@/features/customers/customer-form-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function NewCustomerPage() {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'customer:write');
  return <CustomerFormPage ctx={ctx} basePath="/customers" />;
}
