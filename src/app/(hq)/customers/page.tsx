import { CustomerListPage, type CustomerSearchParams } from '@/features/customers/customer-list-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function HqCustomersPage({ searchParams }: { searchParams: Promise<CustomerSearchParams> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'customer:read');
  return <CustomerListPage ctx={ctx} searchParams={await searchParams} basePath="/customers" />;
}
