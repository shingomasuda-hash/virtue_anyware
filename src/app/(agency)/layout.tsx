import { AppShell } from '@/components/layout/app-shell';
import { AGENCY_NAV } from '@/components/layout/nav-config';
import { requireAgencyContext } from '@/server/auth/guard';
import { can } from '@/server/authz/context';
import { ROLE_LABELS } from '@/server/authz/roles';

export default async function AgencyLayout({ children }: { children: React.ReactNode }) {
  const { ctx, organizationName, agencyName } = await requireAgencyContext();

  const sections = AGENCY_NAV.map((section) => ({
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
      accountHref="/agency/account"
    >
      {children}
    </AppShell>
  );
}
