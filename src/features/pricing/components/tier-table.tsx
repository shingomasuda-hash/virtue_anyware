import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { formatInt, formatYen } from '@/lib/format';
import type { PriceTier, TierValidationIssue } from '@/server/services/pricing/tiers';

/** 成約事務手数料対照表（階段表）。条件表の「以上・未満」表記をそのまま出す。 */
export function TierTable({ tiers, issues }: { tiers: PriceTier[]; issues: TierValidationIssue[] }) {
  const half = Math.ceil(tiers.length / 2);
  const columns = [tiers.slice(0, half), tiers.slice(half)];

  return (
    <>
      {issues.length > 0 ? (
        <ul className="border-b border-[var(--color-border)] px-4 py-2 text-[11px]">
          {issues.map((issue, i) => (
            <li
              key={i}
              className={issue.level === 'error' ? 'text-[var(--color-negative)]' : 'text-[var(--color-warning)]'}
            >
              {issue.level === 'error' ? '❌' : '⚠️'} {issue.message}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="grid gap-0 lg:grid-cols-2">
        {columns.map((column, index) => (
          <TableWrap key={index} className={index === 0 ? 'lg:border-r lg:border-[var(--color-border)]' : undefined}>
            <Table className="min-w-[320px]">
              <thead>
                <tr>
                  <Th>想定使用量(kWh)</Th>
                  <Th align="right">手数料額(円/税抜)</Th>
                </tr>
              </thead>
              <tbody>
                {column.length === 0 ? (
                  <EmptyRow colSpan={2} message="階段表が登録されていません。" />
                ) : (
                  column.map((tier) => (
                    <Tr key={`${tier.minValue}-${tier.maxValue ?? 'max'}`}>
                      <Td className="num">
                        {tier.maxValue === null
                          ? `${formatInt(tier.minValue)}以上`
                          : `${formatInt(tier.minValue)}以上${formatInt(tier.maxValue)}未満`}
                      </Td>
                      <Td numeric>{formatYen(tier.amount)}</Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </Table>
          </TableWrap>
        ))}
      </div>
    </>
  );
}
