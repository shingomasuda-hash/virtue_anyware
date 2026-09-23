import Link from 'next/link';
import { PageHeader } from '@/components/data/page-header';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { UserTable, type UserRow } from '@/features/users/components/user-table';
import { requireHqContext } from '@/server/auth/guard';
import { can, requirePermission } from '@/server/authz/context';
import { listUsers } from '@/server/services/users';

export default async function UsersPage() {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'user:manage');

  const users = await listUsers(ctx);
  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    agencyName: u.agency?.name ?? null,
    phone: u.phone,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
  }));

  return (
    <>
      <PageHeader
        title="ユーザー"
        description="本部スタッフと代理店ユーザーのアカウントを管理します。代理店ロールには所属代理店の指定が必須です。"
        actions={
          <Button asChild variant="primary" size="md">
            <Link href="/users/new">ユーザーを登録</Link>
          </Button>
        }
      />
      <Panel>
        <PanelHeader title={`ユーザー一覧（${rows.length} 名）`} />
        <UserTable rows={rows} canManage={can(ctx, 'user:manage')} />
      </Panel>
    </>
  );
}
