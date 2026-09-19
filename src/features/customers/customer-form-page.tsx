import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/data/page-header';
import { prisma } from '@/server/db';
import { orgScope } from '@/server/authz/scope';
import { isAgencyScoped, type AccessContext } from '@/server/authz/context';
import { findCustomerById } from '@/server/repositories/customer.repo';
import { listAgencies } from '@/server/repositories/agency.repo';
import { CustomerForm, type CustomerFormDefaults } from './components/customer-form';

function toDateInput(value: Date | null | undefined): string {
  if (!value) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export async function CustomerFormPage({
  ctx,
  customerId,
  basePath,
}: {
  ctx: AccessContext;
  customerId?: string;
  basePath: string;
}) {
  const scoped = isAgencyScoped(ctx);
  const scope = orgScope(ctx);

  const [agencies, users, customer] = await Promise.all([
    scoped ? Promise.resolve([]) : listAgencies(ctx),
    prisma.user.findMany({
      where: { ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    customerId ? findCustomerById(ctx, customerId) : Promise.resolve(null),
  ]);

  // 編集時、スコープ外の ID は 404（他代理店の顧客は編集画面すら開けない）
  if (customerId && !customer) notFound();

  const defaults: CustomerFormDefaults = customer
    ? {
        id: customer.id,
        agencyId: customer.agencyId,
        externalCustomerId: customer.externalCustomerId,
        name: customer.name,
        nameKana: customer.nameKana,
        phone: customer.phone,
        email: customer.email,
        postalCode: customer.postalCode,
        prefecture: customer.prefecture,
        city: customer.city,
        address: customer.address,
        building: customer.building,
        birthDate: toDateInput(customer.birthDate),
        assignedUserId: customer.assignedUserId,
        notes: customer.notes,
      }
    : {};

  return (
    <>
      <PageHeader
        title={customer ? `${customer.name} を編集` : '顧客を登録'}
        description={customer ? '変更内容は監査ログに変更前後の値つきで記録されます。' : undefined}
      />
      <CustomerForm
        mode={customer ? 'edit' : 'create'}
        defaults={defaults}
        agencies={agencies.map((a) => ({ value: a.id, label: a.name }))}
        users={users.map((u) => ({ value: u.id, label: u.name }))}
        basePath={basePath}
        canChooseAgency={!scoped}
      />
    </>
  );
}
