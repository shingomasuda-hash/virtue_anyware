import { AppShell } from '@/components/layout/app-shell';
import { HQ_NAV } from '@/components/layout/nav-config';
import { requireHqContext } from '@/server/auth/guard';
import { can } from '@/server/authz/context';
import { ROLE_LABELS } from '@/server/authz/roles';

export default async function HqLayout({ children }: { children: React.ReactNode }) {
  const { ctx, organizationName, agencyName } = await requireHqContext();

  // メニューの出し分けは UX 目的。実際の防御は各ページ / repository 側。
  const sections = HQ_NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.permission || can(ctx, item.permission)),
  })).filter((section) => section.items.length > 0);

  return (
    <AppShell
      sections={sections}
      organizationName={organizationName}
      userName={ctx.name}
      roleLabel={ROLE_LABELS[ctx.role]}
      agencyName={agencyName}
      accountHref="/account"
    >
      {children}
    </AppShell>
  );
}
