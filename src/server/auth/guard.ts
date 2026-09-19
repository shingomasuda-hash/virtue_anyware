import { redirect } from 'next/navigation';
import { prisma } from '@/server/db';
import { requireSession } from './session';
import { isAgencyRole } from '@/server/authz/roles';
import type { AccessContext } from '@/server/authz/context';

export interface ShellContext {
  ctx: AccessContext;
  organizationName: string;
  agencyName: string | null;
}

/** 本部レイアウト用ガード。代理店ロールは代理店画面へ送り返す。 */
export async function requireHqContext(): Promise<ShellContext> {
  const ctx = await requireSession();
  if (isAgencyRole(ctx.role)) redirect('/agency/dashboard');
  return loadShellContext(ctx);
}

/** 代理店レイアウト用ガード。本部ロールも閲覧はできるが agencyId が無い場合は本部へ戻す。 */
export async function requireAgencyContext(): Promise<ShellContext> {
  const ctx = await requireSession();
  if (!isAgencyRole(ctx.role)) redirect('/dashboard');
  return loadShellContext(ctx);
}

async function loadShellContext(ctx: AccessContext): Promise<ShellContext> {
  const [organization, agency] = await Promise.all([
    ctx.organizationId
      ? prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { name: true } })
      : Promise.resolve(null),
    ctx.agencyId
      ? prisma.agency.findUnique({ where: { id: ctx.agencyId }, select: { name: true } })
      : Promise.resolve(null),
  ]);

  return {
    ctx,
    organizationName: organization?.name ?? 'VIRTUE',
    agencyName: agency?.name ?? null,
  };
}
