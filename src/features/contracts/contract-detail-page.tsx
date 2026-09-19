import { notFound } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/data/page-header';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Badge, toneFromColor } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { StatCard, StatGrid } from '@/components/data/stat-card';
import { canViewHqFinancials, type AccessContext } from '@/server/authz/context';
import { getContractDetail } from '@/server/services/contracts';
import { formatDate, formatDateTime, formatNumber, formatPercent, formatWatt, formatYen } from '@/lib/format';
import { toNumber } from '@/lib/money';

export async function ContractDetailPage({
  ctx,
  id,
  customerBasePath,
}: {
  ctx: AccessContext;
  id: string;
  customerBasePath: string;
}) {
  const detail = await getContractDetail(ctx, id);
  if (!detail) notFound();

  const { contract, amounts } = detail;
  const showHq = canViewHqFinancials(ctx);

  return (
    <>
      <PageHeader
        title={contract.contractNumber ?? '（契約番号なし）'}
        description={`${contract.customer.name} / ${contract.product.name}`}
        actions={<Badge tone={toneFromColor(contract.status.color)}>{contract.status.label}</Badge>}
      />

      <StatGrid columns={showHq ? 6 : 3}>
        <StatCard label="契約ワット数" value={formatWatt(toNumber(contract.contractWatt))} />
        {showHq ? <StatCard label="本部単価" value={`${formatNumber(amounts.hqUnitPrice ?? 0)} 円/W`} /> : null}
        <StatCard label="代理店単価" value={`${formatNumber(amounts.agencyUnitPrice)} 円/W`} />
        {showHq ? <StatCard label="VIRTUE売上" value={formatYen(amounts.hqRevenue ?? 0)} /> : null}
        <StatCard label="代理店支払" value={formatYen(amounts.agencyPayout)} />
        {showHq ? <StatCard label="VIRTUE粗利" value={formatYen(amounts.hqGrossProfit ?? 0)} tone="positive" sub={`粗利率 ${formatPercent(amounts.grossMargin ?? 0)}`} /> : null}
      </StatGrid>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="契約情報" />
          <PanelBody>
            <dl className="divide-y divide-[var(--color-border)] text-[13px]">
              <Row label="顧客">
                <Link href={`${customerBasePath}/${contract.customer.id}`} className="text-[var(--color-brand)] hover:underline">
                  {contract.customer.name}
                </Link>
              </Row>
              <Row label="代理店">{contract.agency?.name ?? '—'}</Row>
              <Row label="電力会社">{contract.supplier?.name ?? '—'}</Row>
              <Row label="契約プラン">{contract.plan?.name ?? '—'}</Row>
              <Row label="申込日">{formatDate(contract.appliedAt)}</Row>
              <Row label="契約日">{formatDate(contract.contractedAt)}</Row>
              <Row label="開通日">{formatDate(contract.activatedAt)}</Row>
              <Row label="キャンセル日">{formatDate(contract.cancelledAt)}</Row>
              <Row label="キャンセル理由">{contract.cancelReason ?? '—'}</Row>
            </dl>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader title="獲得情報" description="催事・ブース・担当スタッフ（催事別PL の紐づけ元）" />
          <PanelBody>
            <dl className="divide-y divide-[var(--color-border)] text-[13px]">
              <Row label="催事">{contract.event?.name ?? '—'}</Row>
              <Row label="ブース">{contract.booth ? `${contract.booth.code}${contract.booth.areaName ? ` / ${contract.booth.areaName}` : ''}` : '—'}</Row>
              <Row label="販売スタッフ">{contract.staff?.name ?? '—'}</Row>
              <Row label="キャンペーン">{contract.campaign ?? '—'}</Row>
              <Row label="備考">{contract.notes ?? '—'}</Row>
              <Row label="単価適用日時">{formatDateTime(contract.pricedAt)}</Row>
            </dl>
          </PanelBody>
        </Panel>
      </div>

      {showHq ? (
        <Panel>
          <PanelHeader title="単価スナップショット履歴" description="契約金額がいつ・どの単価で確定したかの記録（監査用）" />
          <TableWrap>
            <Table className="min-w-[900px]">
              <thead>
                <tr>
                  <Th>記録日時</Th>
                  <Th>理由</Th>
                  <Th>基準日</Th>
                  <Th align="right">本部単価</Th>
                  <Th align="right">代理店単価</Th>
                  <Th align="right">売上</Th>
                  <Th align="right">支払</Th>
                  <Th align="right">粗利</Th>
                </tr>
              </thead>
              <tbody>
                {detail.pricingSnapshots.length === 0 ? (
                  <EmptyRow colSpan={8} message="スナップショットがありません。" />
                ) : (
                  detail.pricingSnapshots.map((s) => (
                    <Tr key={s.id}>
                      <Td className="num">{formatDateTime(s.createdAt)}</Td>
                      <Td className="text-[var(--color-ink-muted)]">{s.reason}</Td>
                      <Td className="num">{formatDate(s.basisDate)}</Td>
                      <Td numeric>{formatNumber(toNumber(s.hqUnitPrice))}</Td>
                      <Td numeric>{formatNumber(toNumber(s.agencyUnitPrice))}</Td>
                      <Td numeric>{formatYen(toNumber(s.hqRevenue))}</Td>
                      <Td numeric>{formatYen(toNumber(s.agencyPayout))}</Td>
                      <Td numeric>{formatYen(toNumber(s.hqGrossProfit))}</Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        </Panel>
      ) : null}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-[var(--color-ink-muted)]">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
