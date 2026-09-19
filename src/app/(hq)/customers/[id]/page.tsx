import { CustomerDetailPage } from '@/features/customers/customer-detail-page';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function HqCustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'customer:read');
  const { id } = await params;
  return <CustomerDetailPage ctx={ctx} id={id} contractBasePath="/contracts" customerBasePath="/customers" />;
}
