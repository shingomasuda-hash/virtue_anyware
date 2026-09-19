import { CustomerFormPage } from '@/features/customers/customer-form-page';
import { requireAgencyContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function NewAgencyCustomerPage() {
  const { ctx } = await requireAgencyContext();
  requirePermission(ctx, 'customer:write');
  return <CustomerFormPage ctx={ctx} basePath="/agency/customers" />;
}
