import Link from 'next/link';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { formatInt, formatPercent, formatWatt, formatYen } from '@/lib/format';
import type { AgencyRankRow } from '@/server/services/dashboard';

/**
 * 代理店ランキング（§16）。
 * 代理店ユーザーには本部金額列を描画しない（そもそもサーバーから返していない）。
 */
export function AgencyRanking({ rows, showHqFinancials }: { rows: AgencyRankRow[]; showHqFinancials: boolean }) {
  const colSpan = showHqFinancials ? 7 : 5;
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>代理店</Th>
            <Th align="right">契約件数</Th>
            <Th align="right">ワット数</Th>
            {showHqFinancials ? <Th align="right">VIRTUE売上</Th> : null}
            <Th align="right">代理店支払</Th>
            {showHqFinancials ? <Th align="right">VIRTUE粗利</Th> : null}
            <Th align="right">キャンセル率</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={colSpan} message="対象期間の契約がありません。" />
          ) : (
            rows.map((row) => (
              <Tr key={row.agencyId}>
                <Td>
                  <Link href={`/agencies/${row.agencyId}`} className="text-[var(--color-brand)] hover:underline">
                    {row.agencyName}
                  </Link>
                  <span className="ml-1.5 text-[11px] text-[var(--color-ink-subtle)]">{row.agencyCode}</span>
                </Td>
                <Td numeric>{formatInt(row.contracts)}</Td>
                <Td numeric>{formatWatt(row.watt)}</Td>
                {showHqFinancials ? <Td numeric>{formatYen(row.hqRevenue)}</Td> : null}
                <Td numeric>{formatYen(row.agencyPayout)}</Td>
                {showHqFinancials ? <Td numeric>{formatYen(row.hqGrossProfit)}</Td> : null}
                <Td numeric>{formatPercent(row.cancellationRate)}</Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>
    </TableWrap>
  );
}
