import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { formatDate, formatNumber } from '@/lib/format';

export interface UnitPriceRow {
  id: string;
  productName: string | null;
  unitType: string;
  unitPrice: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  note: string | null;
}

const UNIT_TYPE_LABEL: Record<string, string> = {
  PER_WATT: '円/W',
  PER_CONTRACT: '円/件',
  PERCENT_OF_AMOUNT: '販売額比率',
  FIXED: '定額',
};

/**
 * 代理店単価の履歴（§5）。
 * 適用期間を持つため、過去契約の金額は単価改定の影響を受けない。
 */
export function UnitPriceHistory({ rows }: { rows: UnitPriceRow[] }) {
  return (
    <>
      <TableWrap>
        <Table className="min-w-[640px]">
          <thead>
            <tr>
              <Th>適用開始</Th>
              <Th>適用終了</Th>
              <Th>商材</Th>
              <Th align="right">単価</Th>
              <Th>単位</Th>
              <Th>備考</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={6} message="単価が登録されていません。" />
            ) : (
              rows.map((row) => (
                <Tr key={row.id}>
                  <Td className="num">{formatDate(row.effectiveFrom)}</Td>
                  <Td className="num text-[var(--color-ink-muted)]">{row.effectiveTo ? formatDate(row.effectiveTo) : '（現行）'}</Td>
                  <Td>{row.productName ?? '全商材'}</Td>
                  <Td numeric>{formatNumber(row.unitPrice)}</Td>
                  <Td className="text-[var(--color-ink-muted)]">{UNIT_TYPE_LABEL[row.unitType] ?? row.unitType}</Td>
                  <Td className="text-[var(--color-ink-muted)]">{row.note ?? '—'}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </TableWrap>
      <p className="border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-ink-subtle)]">
        単価は適用期間で管理されます。契約登録時の単価は契約行にスナップショット保存されるため、
        ここで単価を変更しても過去契約の金額・粗利は変わりません。
      </p>
    </>
  );
}
