import { CustomerListPage, type CustomerSearchParams } from '@/features/customers/customer-list-page';
import { requireAgencyContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function AgencyCustomersPage({ searchParams }: { searchParams: Promise<CustomerSearchParams> }) {
  const { ctx } = await requireAgencyContext();
  requirePermission(ctx, 'customer:read');
  // repository 側で agencyId = 自社 が強制されるため、他代理店の顧客は取得できない
  return <CustomerListPage ctx={ctx} searchParams={await searchParams} basePath="/agency/customers" />;
}
