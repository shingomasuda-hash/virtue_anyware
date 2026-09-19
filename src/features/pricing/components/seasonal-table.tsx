import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { formatDate, formatPercent } from '@/lib/format';
import type { SeasonalCoefficientGroup } from '@/server/services/pricing/overview';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * 季節係数表。
 * 使用量の多い月ほど係数が小さく、明細の使用量を平準化して想定使用量を求める。
 */
export function SeasonalTable({ group }: { group: SeasonalCoefficientGroup }) {
  return (
    <>
      <p className="border-b border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-ink-subtle)]">
        {group.supplierName ?? '全供給元共通'} / 適用 {formatDate(group.effectiveFrom)}
        {group.effectiveTo ? ` 〜 ${formatDate(group.effectiveTo)}` : ' 〜（現行）'}
        {' · '}想定使用量 = 明細の使用量 × 検針月の係数
      </p>
      <TableWrap>
        <Table className="min-w-[760px]">
          <thead>
            <tr>
              <Th>月</Th>
              {MONTHS.map((m) => (
                <Th key={m} align="right">{m}月</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Tr>
              <Td className="font-medium">季節係数</Td>
              {MONTHS.map((m) => {
                const value = group.byMonth[m];
                const high = value !== undefined && value >= 1;
                return (
                  <Td
                    key={m}
                    numeric
                    className={high ? 'text-[var(--color-brand)]' : 'text-[var(--color-ink-muted)]'}
                  >
                    {value === undefined ? '—' : formatPercent(value)}
                  </Td>
                );
              })}
            </Tr>
          </tbody>
        </Table>
      </TableWrap>
    </>
  );
}
