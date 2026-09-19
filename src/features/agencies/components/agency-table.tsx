import Link from 'next/link';
import { Badge, toneFromColor } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { formatDate, formatInt } from '@/lib/format';

export interface AgencyRow {
  id: string;
  code: string;
  name: string;
  corporateName: string | null;
  contactPerson: string | null;
  phone: string | null;
  prefecture: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  counts: { customers: number; contracts: number; users: number };
}

const STATUS_LABEL: Record<AgencyRow['status'], { label: string; color: string }> = {
  ACTIVE: { label: '稼働中', color: 'green' },
  INACTIVE: { label: '停止', color: 'slate' },
  SUSPENDED: { label: '一時停止', color: 'amber' },
};

export function AgencyTable({ rows }: { rows: AgencyRow[] }) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>コード</Th>
            <Th>代理店名</Th>
            <Th>法人名</Th>
            <Th>担当者</Th>
            <Th>都道府県</Th>
            <Th align="right">顧客</Th>
            <Th align="right">契約</Th>
            <Th>契約期間</Th>
            <Th>ステータス</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={9} message="代理店が登録されていません。" />
          ) : (
            rows.map((row) => {
              const status = STATUS_LABEL[row.status];
              return (
                <Tr key={row.id}>
                  <Td className="num text-[var(--color-ink-subtle)]">{row.code}</Td>
                  <Td>
                    <Link href={`/agencies/${row.id}`} className="font-medium text-[var(--color-brand)] hover:underline">
                      {row.name}
                    </Link>
                  </Td>
                  <Td className="text-[var(--color-ink-muted)]">{row.corporateName ?? '—'}</Td>
                  <Td className="text-[var(--color-ink-muted)]">{row.contactPerson ?? '—'}</Td>
                  <Td className="text-[var(--color-ink-muted)]">{row.prefecture ?? '—'}</Td>
                  <Td numeric>{formatInt(row.counts.customers)}</Td>
                  <Td numeric>{formatInt(row.counts.contracts)}</Td>
                  <Td className="whitespace-nowrap text-[12px] text-[var(--color-ink-muted)]">
                    {formatDate(row.contractStartDate)} 〜 {row.contractEndDate ? formatDate(row.contractEndDate) : ''}
                  </Td>
                  <Td>
                    <Badge tone={toneFromColor(status.color)}>{status.label}</Badge>
                  </Td>
                </Tr>
              );
            })
          )}
        </tbody>
      </Table>
    </TableWrap>
  );
}
