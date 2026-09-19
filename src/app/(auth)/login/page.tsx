import { redirect } from 'next/navigation';
import { getAccessContext } from '@/server/auth/session';
import { isAgencyRole } from '@/server/authz/roles';
import { LoginForm } from '@/features/auth/components/login-form';

export const metadata = { title: 'ログイン | VIRTUE Sales OS' };

export default async function LoginPage() {
  const ctx = await getAccessContext();
  if (ctx) redirect(isAgencyRole(ctx.role) ? '/agency/dashboard' : '/dashboard');

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand)] text-[13px] font-bold text-white">
            V
          </span>
          <div>
            <p className="text-[15px] font-semibold leading-tight">VIRTUE Sales OS</p>
            <p className="text-[11px] text-[var(--color-ink-subtle)]">販売・代理店・催事・収益の統合管理</p>
          </div>
        </div>
        <LoginForm />
        <p className="mt-6 text-[11px] leading-relaxed text-[var(--color-ink-subtle)]">
          本システムは個人情報を取り扱います。アカウントの共有・ID の貸与は禁止されています。
          操作内容は監査ログへ記録されます。
        </p>
      </div>
    </div>
  );
}
