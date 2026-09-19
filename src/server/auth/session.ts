import { headers } from 'next/headers';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from './auth';
import { AuthenticationError, type AccessContext } from '@/server/authz/context';
import { isRole } from '@/server/authz/roles';

/** リクエスト内で 1 回だけセッションを解決する（React cache）。 */
export const getAccessContext = cache(async (): Promise<AccessContext | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const user = session.user as typeof session.user & {
    role?: string;
    organizationId?: string | null;
    agencyId?: string | null;
    isActive?: boolean;
  };

  if (user.isActive === false) return null;
  const role = user.role && isRole(user.role) ? user.role : null;
  if (!role) return null;

  return {
    userId: user.id,
    role,
    organizationId: user.organizationId ?? null,
    agencyId: user.agencyId ?? null,
    email: user.email,
    name: user.name,
  };
});

/** Server Action / Route Handler 用。未認証は例外。 */
export async function requireAccessContext(): Promise<AccessContext> {
  const ctx = await getAccessContext();
  if (!ctx) throw new AuthenticationError();
  return ctx;
}

/** Server Component（ページ）用。未認証はログイン画面へ。 */
export async function requireSession(): Promise<AccessContext> {
  const ctx = await getAccessContext();
  if (!ctx) redirect('/login');
  return ctx;
}
