import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/data/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { StatCard, StatGrid } from '@/components/data/stat-card';
import { UnitPriceHistory, type UnitPriceRow } from '@/features/agencies/components/unit-price-history';
import { requireHqContext } from '@/server/auth/guard';
import { can, requirePermission } from '@/server/authz/context';
import { Button } from '@/components/ui/button';
import { UnitPriceForm } from '@/features/agencies/components/unit-price-form';
import { prisma } from '@/server/db';
import { orgScope } from '@/server/authz/scope';
import { findAgencyById } from '@/server/repositories/agency.repo';
import { formatDate, formatInt } from '@/lib/format';
import { toNumber } from '@/lib/money';

export default async function AgencyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'agency:read');

  const { id } = await params;
  const agency = await findAgencyById(ctx, id);
  // スコープ外の ID は null になるため 404（他代理店の ID 直打ち対策）
  if (!agency) notFound();

  const priceRows: UnitPriceRow[] = agency.unitPrices.map((p) => ({
    id: p.id,
    productName: p.product?.name ?? null,
    unitType: p.unitType,
    unitPrice: toNumber(p.unitPrice),
    effectiveFrom: p.effectiveFrom,
    effectiveTo: p.effectiveTo,
    note: p.note,
  }));

  const scope = orgScope(ctx);
  const products = await prisma.product.findMany({
    where: { ...(scope.organizationId ? { organizationId: scope.organizationId } : {}), isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <>
      <PageHeader
        title={agency.name}
        description={`${agency.code}${agency.corporateName ? ` / ${agency.corporateName}` : ''}`}
        actions={
          can(ctx, 'agency:write') ? (
            <Button asChild variant="secondary" size="md">
              <Link href={`/agencies/${agency.id}/edit`}>代理店を編集</Link>
            </Button>
          ) : null
        }
      />

      <StatGrid columns={4}>
        <StatCard label="顧客数" value={formatInt(agency._count.customers)} />
        <StatCard label="契約数" value={formatInt(agency._count.contracts)} />
        <StatCard label="ユーザー数" value={formatInt(agency._count.users)} />
        <StatCard label="スタッフ数" value={formatInt(agency._count.staff)} />
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="基本情報" />
          <PanelBody>
            <dl className="divide-y divide-[var(--color-border)] text-[13px]">
              <Row label="担当者" value={agency.contactPerson} />
              <Row label="電話番号" value={agency.phone} />
              <Row label="メール" value={agency.email} />
              <Row label="住所" value={[agency.postalCode, agency.prefecture, agency.city, agency.address, agency.building].filter(Boolean).join(' ')} />
              <Row label="契約開始日" value={formatDate(agency.contractStartDate)} />
              <Row label="契約終了日" value={agency.contractEndDate ? formatDate(agency.contractEndDate) : '—'} />
              <Row label="支払条件" value={agency.paymentTerms} />
              <Row label="備考" value={agency.notes} />
            </dl>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="振込先情報" description="精算時の支払先。閲覧は監査ログに記録されます。" />
          <PanelBody>
            <dl className="divide-y divide-[var(--color-border)] text-[13px]">
              <Row label="金融機関" value={agency.bankName} />
              <Row label="支店" value={agency.bankBranch} />
              <Row label="口座種別" value={agency.bankAccountType} />
              <Row label="口座番号" value={agency.bankAccountNumber} />
              <Row label="口座名義" value={agency.bankAccountHolder} />
            </dl>
          </PanelBody>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="代理店単価履歴"
          description="適用期間つき。過去契約の金額はスナップショットで保護されます。"
        />
        <UnitPriceHistory rows={priceRows} />
        {can(ctx, 'pricing:write') ? (
          <UnitPriceForm
            agencyId={agency.id}
            products={products.map((p) => ({ value: p.id, label: p.name }))}
          />
        ) : null}
      </Panel>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="text-right">{value && value.trim() !== '' ? value : '—'}</dd>
    </div>
  );
}
