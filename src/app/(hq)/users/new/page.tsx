import { PageHeader } from '@/components/data/page-header';
import { UserForm } from '@/features/users/components/user-form';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';
import { assignableRoles, getUserFormOptions } from '@/server/services/users';

export default async function NewUserPage() {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'user:manage');

  const { agencies } = await getUserFormOptions(ctx);

  return (
    <>
      <PageHeader
        title="ユーザーを登録"
        description="初期パスワードを設定して登録します。本人には「アカウント設定」からの変更を必ず案内してください。"
      />
      <UserForm
        mode="create"
        defaults={{ role: 'HQ_STAFF', isActive: true }}
        agencies={agencies}
        assignableRoles={[...assignableRoles(ctx)]}
      />
    </>
  );
}
