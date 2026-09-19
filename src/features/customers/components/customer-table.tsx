import Link from 'next/link';
import { Badge, toneFromColor } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { formatDate, formatInt, formatWatt, maskPhone } from '@/lib/format';

export interface CustomerRow {
  id: string;
  name: string;
  nameKana: string | null;
  phone: string | null;
  prefecture: string | null;
  agencyName: string | null;
  assigneeName: string | null;
  contractCount: number;
  latestContract: {
    contractNumber: string | null;
    statusLabel: string;
    statusColor: string;
    contractedAt: Date | null;
    watt: number;
  } | null;
  upsellStatusLabel: string | null;
  upsellStatusColor: string | null;
}

export function CustomerTable({ rows, basePath, showAgency }: { rows: CustomerRow[]; basePath: string; showAgency: boolean }) {
  const colSpan = showAgency ? 9 : 8;
  return (
    <TableWrap>
      <Table className="min-w-[980px]">
        <thead>
          <tr>
            <Th>顧客名</Th>
            <Th>電話番号</Th>
            <Th>都道府県</Th>
            {showAgency ? <Th>代理店</Th> : null}
            <Th>契約番号</Th>
            <Th>契約日</Th>
            <Th align="right">W数</Th>
            <Th>契約ステータス</Th>
            <Th>アップセル</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={colSpan} message="条件に一致する顧客がいません。" />
          ) : (
            rows.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <Link href={`${basePath}/${row.id}`} className="font-medium text-[var(--color-brand)] hover:underline">
                    {row.name}
                  </Link>
                  {row.nameKana ? <span className="ml-1.5 text-[11px] text-[var(--color-ink-subtle)]">{row.nameKana}</span> : null}
                  {row.contractCount > 1 ? (
                    <span className="ml-1.5 text-[11px] text-[var(--color-ink-subtle)]">契約{formatInt(row.contractCount)}件</span>
                  ) : null}
                </Td>
                {/* 一覧では PII を部分マスクする（§31） */}
                <Td className="num text-[var(--color-ink-muted)]">{maskPhone(row.phone)}</Td>
                <Td className="text-[var(--color-ink-muted)]">{row.prefecture ?? '—'}</Td>
                {showAgency ? <Td className="text-[var(--color-ink-muted)]">{row.agencyName ?? '—'}</Td> : null}
                <Td className="num text-[var(--color-ink-muted)]">{row.latestContract?.contractNumber ?? '—'}</Td>
                <Td className="num">{formatDate(row.latestContract?.contractedAt)}</Td>
                <Td numeric>{row.latestContract ? formatWatt(row.latestContract.watt) : '—'}</Td>
                <Td>
                  {row.latestContract ? (
                    <Badge tone={toneFromColor(row.latestContract.statusColor)}>{row.latestContract.statusLabel}</Badge>
                  ) : (
                    '—'
                  )}
                </Td>
                <Td>
                  {row.upsellStatusLabel ? (
                    <Badge tone={toneFromColor(row.upsellStatusColor ?? 'slate')}>{row.upsellStatusLabel}</Badge>
                  ) : (
                    '—'
                  )}
                </Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>
    </TableWrap>
  );
}
