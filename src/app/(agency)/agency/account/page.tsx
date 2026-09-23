import { PageHeader } from '@/components/data/page-header';
import { AccountSummary } from '@/features/users/components/account-summary';
import { ChangePasswordForm } from '@/features/users/components/change-password-form';
import { requireAgencyContext } from '@/server/auth/guard';

export default async function AgencyAccountPage() {
  const { ctx, organizationName, agencyName } = await requireAgencyContext();
  return (
    <>
      <PageHeader title="アカウント設定" description="ご自身のログイン情報を確認・変更できます。" />
      <AccountSummary ctx={ctx} organizationName={organizationName} agencyName={agencyName} />
      <ChangePasswordForm />
    </>
  );
}
