import { PageHeader } from '@/components/data/page-header';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Badge, toneFromColor } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import type { AccessContext } from '@/server/authz/context';
import { aggregatePipeline } from '@/server/services/deals/repo';
import { formatInt, formatPercent, formatYen } from '@/lib/format';
import { safeDivide } from '@/lib/money';
import { DEAL_STAGE_LABELS } from './labels';

/** ステータス別の件数と販売価格合計（docs/15_DEAL_MANAGEMENT.md 15.6）。 */
export async function DealPipelinePage({ ctx }: { ctx: AccessContext }) {
  const rows = await aggregatePipeline(ctx);
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const maxCount = rows.reduce((max, r) => Math.max(max, r.count), 0);

  return (
    <>
      <PageHeader
        title="案件ファネル"
        description="案件ステータスごとの件数と販売価格（税抜）の合計。構成比は全案件に対する割合です。"
      />
      <Panel>
        <PanelHeader title={`全 ${formatInt(total)} 件`} />
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>ステータス</Th>
                <Th>区分</Th>
                <Th align="right">件数</Th>
                <Th align="right">構成比</Th>
                <Th align="right">販売価格合計</Th>
                <Th>分布</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Tr key={row.statusId}>
                  <Td>
                    <Badge tone={toneFromColor(row.color)}>{row.label}</Badge>
                  </Td>
                  <Td className="text-[12px] text-[var(--color-ink-muted)]">{DEAL_STAGE_LABELS[row.stage]}</Td>
                  <Td numeric>{formatInt(row.count)}</Td>
                  <Td numeric>{formatPercent(safeDivide(row.count, total))}</Td>
                  <Td numeric>{row.amount === 0 ? '—' : formatYen(row.amount)}</Td>
                  <Td>
                    <div className="h-2 w-full max-w-[220px] rounded-full bg-[var(--color-neutral-soft)]">
                      <div
                        className="h-2 rounded-full bg-[var(--color-brand)]"
                        style={{ width: `${maxCount === 0 ? 0 : (row.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Panel>
    </>
  );
}
