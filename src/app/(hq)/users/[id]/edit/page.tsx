import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/data/page-header';
import { UserForm } from '@/features/users/components/user-form';
import { PasswordResetForm } from '@/features/users/components/password-reset-form';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';
import { assignableRoles, findUserById, getUserFormOptions } from '@/server/services/users';

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'user:manage');

  const { id } = await params;
  const user = await findUserById(ctx, id);
  if (!user) notFound();

  // SUPER_ADMIN の編集画面は SUPER_ADMIN にしか見せない（サーバー側で遮断する）
  if (user.role === 'SUPER_ADMIN' && ctx.role !== 'SUPER_ADMIN') notFound();

  const { agencies } = await getUserFormOptions(ctx);

  return (
    <>
      <PageHeader title={`${user.name} さんの設定`} description={user.email} />
      <UserForm
        mode="edit"
        defaults={{
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          agencyId: user.agencyId,
          phone: user.phone,
          isActive: user.isActive,
        }}
        agencies={agencies}
        assignableRoles={[...assignableRoles(ctx)]}
      />
      <PasswordResetForm userId={user.id} userName={user.name} />
    </>
  );
}
