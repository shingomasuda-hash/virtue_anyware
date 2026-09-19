import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { formatInt, formatPercent } from '@/lib/format';
import type { FunnelStepWithRate } from '@/server/services/kpi';

/** アップセルファネル（§23）。転換率の定義は docs/KPI_DEFINITIONS.md に従う。 */
export function FunnelTable({ steps }: { steps: FunnelStepWithRate[] }) {
  return (
    <TableWrap>
      <Table className="min-w-[420px]">
        <thead>
          <tr>
            <Th>段階</Th>
            <Th align="right">件数</Th>
            <Th align="right">直前比</Th>
            <Th align="right">通過率</Th>
          </tr>
        </thead>
        <tbody>
          {steps.length === 0 ? (
            <EmptyRow colSpan={4} message="アップセルデータがありません。" />
          ) : (
            steps.map((step) => (
              <Tr key={step.key}>
                <Td>{step.label}</Td>
                <Td numeric>{formatInt(step.count)}</Td>
                <Td numeric>{formatPercent(step.conversionRate)}</Td>
                <Td numeric>{formatPercent(step.overallRate)}</Td>
              </Tr>
            ))
          )}
        </tbody>
      </Table>
    </TableWrap>
  );
}
