import { PageHeader } from '@/components/data/page-header';
import { AgencyForm } from '@/features/agencies/components/agency-form';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

export default async function NewAgencyPage() {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'agency:write');
  return (
    <>
      <PageHeader title="代理店を登録" description="登録後、単価は代理店詳細画面から適用期間つきで設定します。" />
      <AgencyForm mode="create" defaults={{ status: 'ACTIVE' }} />
    </>
  );
}
