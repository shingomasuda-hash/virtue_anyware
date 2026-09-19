import { CustomerDetailPage } from '@/features/customers/customer-detail-page';
import { requireAgencyContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function AgencyCustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireAgencyContext();
  requirePermission(ctx, 'customer:read');
  const { id } = await params;
  return <CustomerDetailPage ctx={ctx} id={id} contractBasePath="/agency/contracts" customerBasePath="/agency/customers" />;
}
