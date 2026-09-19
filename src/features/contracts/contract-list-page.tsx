import Link from 'next/link';
import { PageHeader } from '@/components/data/page-header';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Pagination } from '@/components/data/pagination';
import { Badge, toneFromColor } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { canViewHqFinancials, isAgencyScoped, type AccessContext } from '@/server/authz/context';
import { getContractList } from '@/server/services/contracts';
import { parseDateOnly } from '@/lib/date';
import { formatDate, formatPercent, formatWatt, formatYen } from '@/lib/format';

export type ContractSearchParams = Partial<Record<'q' | 'statusId' | 'agencyId' | 'from' | 'to' | 'page', string>>;

/**
 * 契約一覧。
 * 本部金額の列は権限がある場合のみ描画する。
 * DTO 自体に hqRevenue 等が存在しないため、UI の分岐ミスで漏れることがない。
 */
export async function ContractListPage({
  ctx,
  searchParams,
  basePath,
  customerBasePath,
}: {
  ctx: AccessContext;
  searchParams: ContractSearchParams;
  basePath: string;
  customerBasePath: string;
}) {
  const page = Number(searchParams.page ?? '1') || 1;
  const showHq = canViewHqFinancials(ctx);
  const showAgency = !isAgencyScoped(ctx);

  const result = await getContractList(ctx, {
    keyword: searchParams.q || undefined,
    statusId: searchParams.statusId || undefined,
    agencyId: searchParams.agencyId || undefined,
    contractedFrom: parseDateOnly(searchParams.from ?? null) ?? undefined,
    contractedTo: parseDateOnly(searchParams.to ?? null) ?? undefined,
    page,
  });

  const colSpan = 7 + (showAgency ? 1 : 0) + (showHq ? 3 : 1);

  function buildHref(nextPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== 'page') params.set(key, value);
    }
    params.set('page', String(nextPage));
    return `${basePath}?${params.toString()}`;
  }

  return (
    <>
      <PageHeader
        title="電力契約"
        description={
          showHq
            ? '金額は契約時点の単価スナップショット。単価マスタを変更しても過去契約の数字は変わりません。'
            : '自社契約のみ表示しています。表示金額は自社の支払予定額です。'
        }
      />
      <Panel>
        <PanelHeader title={`契約一覧 ${result.total} 件`} />
        <TableWrap>
          <Table className="min-w-[1080px]">
            <thead>
              <tr>
                <Th>契約番号</Th>
                <Th>顧客</Th>
                {showAgency ? <Th>代理店</Th> : null}
                <Th>商材 / プラン</Th>
                <Th align="right">契約W</Th>
                <Th>契約日</Th>
                <Th>開通日</Th>
                {showHq ? <Th align="right">VIRTUE売上</Th> : null}
                <Th align="right">代理店支払</Th>
                {showHq ? <Th align="right">粗利</Th> : null}
                {showHq ? <Th align="right">粗利率</Th> : null}
                <Th>ステータス</Th>
              </tr>
            </thead>
            <tbody>
              {result.items.length === 0 ? (
                <EmptyRow colSpan={colSpan} message="契約がありません。" />
              ) : (
                result.items.map((c) => (
                  <Tr key={c.id}>
                    <Td>
                      <Link href={`${basePath}/${c.id}`} className="text-[var(--color-brand)] hover:underline">
                        {c.contractNumber ?? '（番号なし）'}
                      </Link>
                    </Td>
                    <Td>
                      <Link href={`${customerBasePath}/${c.customerId}`} className="hover:underline">
                        {c.customerName}
                      </Link>
                    </Td>
                    {showAgency ? <Td className="text-[var(--color-ink-muted)]">{c.agencyName ?? '—'}</Td> : null}
                    <Td className="text-[var(--color-ink-muted)]">
                      {[c.productName, c.planName].filter(Boolean).join(' / ')}
                    </Td>
                    <Td numeric>{formatWatt(c.contractWatt)}</Td>
                    <Td className="num">{formatDate(c.contractedAt)}</Td>
                    <Td className="num">{formatDate(c.activatedAt)}</Td>
                    {showHq ? <Td numeric>{formatYen(c.hqRevenue ?? 0)}</Td> : null}
                    <Td numeric>{formatYen(c.agencyPayout)}</Td>
                    {showHq ? <Td numeric>{formatYen(c.hqGrossProfit ?? 0)}</Td> : null}
                    {showHq ? <Td numeric>{formatPercent(c.grossMargin ?? 0)}</Td> : null}
                    <Td>
                      <Badge tone={toneFromColor(c.statusColor)}>{c.statusLabel}</Badge>
                    </Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
        <Pagination page={result.page} pageCount={result.pageCount} total={result.total} buildHref={buildHref} />
      </Panel>
    </>
  );
}
