import Link from 'next/link';
import { PageHeader } from '@/components/data/page-header';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { AgencyTable, type AgencyRow } from '@/features/agencies/components/agency-table';
import { requireHqContext } from '@/server/auth/guard';
import { can, requirePermission } from '@/server/authz/context';
import { listAgencies } from '@/server/repositories/agency.repo';

export default async function AgenciesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'agency:read');

  const { q } = await searchParams;
  const agencies = await listAgencies(ctx, { keyword: q });

  const rows: AgencyRow[] = agencies.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    corporateName: a.corporateName,
    contactPerson: a.contactPerson,
    phone: a.phone,
    prefecture: a.prefecture,
    status: a.status,
    contractStartDate: a.contractStartDate,
    contractEndDate: a.contractEndDate,
    counts: { customers: a._count.customers, contracts: a._count.contracts, users: a._count.users },
  }));

  return (
    <>
      <PageHeader
        title="代理店"
        description="VIRTUE 配下の販売代理店マスタ。単価は代理店ごとに適用期間つきで管理します。"
        actions={
          can(ctx, 'agency:write') ? (
            <Button asChild variant="primary" size="md">
              <Link href="/agencies/new">代理店を登録</Link>
            </Button>
          ) : null
        }
      />
      <Panel>
        <PanelHeader title={`代理店一覧（${rows.length} 社）`} />
        <AgencyTable rows={rows} />
      </Panel>
    </>
  );
}
