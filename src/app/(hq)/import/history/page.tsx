import Link from 'next/link';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Pagination } from '@/components/data/pagination';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';
import { listBatches } from '@/server/services/import/upload';
import { formatDateTime, formatInt } from '@/lib/format';

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: '下書き', tone: 'neutral' },
  VALIDATED: { label: '検証済み', tone: 'brand' },
  COMMITTED: { label: '取込済み', tone: 'positive' },
  FAILED: { label: '失敗', tone: 'negative' },
  ROLLED_BACK: { label: 'ロールバック済み', tone: 'warning' },
};

/** 取込履歴（§10）。バッチ単位で件数と結果を保持する。 */
export default async function ImportHistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'import:run');

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam ?? '1') || 1);
  const result = await listBatches(ctx, page);

  return (
    <Panel>
      <PanelHeader title={`インポート履歴（${result.total} 件）`} />
      <TableWrap>
        <Table className="min-w-[1080px]">
          <thead>
            <tr>
              <Th>取込日時</Th>
              <Th>ファイル名</Th>
              <Th>取込ユーザー</Th>
              <Th>テンプレート</Th>
              <Th align="right">総行数</Th>
              <Th align="right">新規</Th>
              <Th align="right">更新</Th>
              <Th align="right">重複</Th>
              <Th align="right">エラー</Th>
              <Th>状態</Th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <EmptyRow colSpan={10} message="取込履歴はまだありません。" />
            ) : (
              result.items.map((batch) => {
                const meta = STATUS_META[batch.status] ?? { label: batch.status, tone: 'neutral' as BadgeTone };
                return (
                  <Tr key={batch.id}>
                    <Td className="num whitespace-nowrap">{formatDateTime(batch.createdAt)}</Td>
                    <Td>
                      <Link href={`/import/history/${batch.id}`} className="text-[var(--color-brand)] hover:underline">
                        {batch.fileName}
                      </Link>
                    </Td>
                    <Td className="text-[var(--color-ink-muted)]">{batch.importedBy?.name ?? '—'}</Td>
                    <Td className="text-[var(--color-ink-muted)]">{batch.template?.name ?? '—'}</Td>
                    <Td numeric>{formatInt(batch.totalRows)}</Td>
                    <Td numeric>{formatInt(batch.createdCount)}</Td>
                    <Td numeric>{formatInt(batch.updatedCount)}</Td>
                    <Td numeric>{formatInt(batch.duplicateCount)}</Td>
                    <Td numeric className={batch.failureCount > 0 ? 'text-[var(--color-negative)]' : undefined}>
                      {formatInt(batch.failureCount)}
                    </Td>
                    <Td><Badge tone={meta.tone}>{meta.label}</Badge></Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        total={result.total}
        buildHref={(p) => `/import/history?page=${p}`}
      />
    </Panel>
  );
}
