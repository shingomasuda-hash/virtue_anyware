import { redirect } from 'next/navigation';
import { getAccessContext } from '@/server/auth/session';
import { isAgencyRole } from '@/server/authz/roles';

export default async function RootPage() {
  const ctx = await getAccessContext();
  if (!ctx) redirect('/login');
  redirect(isAgencyRole(ctx.role) ? '/agency/dashboard' : '/dashboard');
}
