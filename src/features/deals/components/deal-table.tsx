import Link from 'next/link';
import { Badge, toneFromColor } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { formatDate, formatYen } from '@/lib/format';
import type { DealPriority, DealProductType } from '@/generated/prisma';
import { DEAL_PRIORITY_LABELS, DEAL_PRODUCT_TYPE_LABELS } from '../labels';

export interface DealRow {
  id: string;
  code: string;
  customerId: string;
  customerName: string;
  statusLabel: string;
  statusColor: string;
  productTypes: DealProductType[];
  agencyName: string | null;
  closerName: string | null;
  metAt: Date | null;
  contractedAt: Date | null;
  salesPriceExclTax: number | null;
  nextActionAt: Date | null;
  priority: DealPriority;
}

const PRIORITY_TONE: Record<DealPriority, 'negative' | 'warning' | 'neutral'> = {
  HIGH: 'negative',
  MEDIUM: 'warning',
  LOW: 'neutral',
};

export function DealTable({
  rows,
  basePath,
  customerBasePath,
  showAgency,
  today,
}: {
  rows: DealRow[];
  basePath: string;
  customerBasePath: string;
  showAgency: boolean;
  /** 次回アクション超過の判定基準日。サーバー側で決め、画面で計算しない。 */
  today: Date;
}) {
  const colSpan = 10 + (showAgency ? 1 : 0);

  return (
    <TableWrap>
      <Table className="min-w-[1100px]">
        <thead>
          <tr>
            <Th>案件ID</Th>
            <Th>顧客</Th>
            <Th>ステータス</Th>
            <Th>商材</Th>
            {showAgency ? <Th>代理店</Th> : null}
            <Th>営業</Th>
            <Th>商談日</Th>
            <Th>契約日</Th>
            <Th align="right">販売価格(税抜)</Th>
            <Th>次回アクション</Th>
            <Th>優先度</Th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={colSpan} message="条件に一致する案件がありません。" />
          ) : (
            rows.map((row) => {
              const overdue = row.nextActionAt !== null && row.nextActionAt < today;
              return (
                <Tr key={row.id}>
                  <Td className="num">
                    <Link href={`${basePath}/${row.id}`} className="font-medium text-[var(--color-brand)] hover:underline">
                      {row.code}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`${customerBasePath}/${row.customerId}`} className="hover:underline">
                      {row.customerName}
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={toneFromColor(row.statusColor)}>{row.statusLabel}</Badge>
                  </Td>
                  <Td className="text-[12px] text-[var(--color-ink-muted)]">
                    {row.productTypes.length === 0
                      ? '—'
                      : row.productTypes.map((t) => DEAL_PRODUCT_TYPE_LABELS[t]).join('・')}
                  </Td>
                  {showAgency ? (
                    <Td className="text-[var(--color-ink-muted)]">{row.agencyName ?? '自社'}</Td>
                  ) : null}
                  <Td className="text-[var(--color-ink-muted)]">{row.closerName ?? '—'}</Td>
                  <Td className="num">{formatDate(row.metAt)}</Td>
                  <Td className="num">{formatDate(row.contractedAt)}</Td>
                  <Td numeric>{row.salesPriceExclTax === null ? '—' : formatYen(row.salesPriceExclTax)}</Td>
                  <Td className="num whitespace-nowrap">
                    {row.nextActionAt === null ? (
                      '—'
                    ) : overdue ? (
                      <span className="font-medium text-[var(--color-negative)]">
                        {formatDate(row.nextActionAt)} 超過
                      </span>
                    ) : (
                      formatDate(row.nextActionAt)
                    )}
                  </Td>
                  <Td>
                    <Badge tone={PRIORITY_TONE[row.priority]}>{DEAL_PRIORITY_LABELS[row.priority]}</Badge>
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
