import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { StatCard, StatGrid } from '@/components/data/stat-card';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RollbackButton } from '@/features/import/components/rollback-button';
import { requireHqContext } from '@/server/auth/guard';
import { can, requirePermission } from '@/server/authz/context';
import { prisma } from '@/server/db';
import { findBatch } from '@/server/services/import/upload';
import { formatDateTime, formatInt } from '@/lib/format';

const ROW_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  PENDING: { label: '未処理', tone: 'neutral' },
  CREATED: { label: '新規登録', tone: 'positive' },
  UPDATED: { label: '更新', tone: 'brand' },
  SKIPPED_DUPLICATE: { label: '重複スキップ', tone: 'warning' },
  NEEDS_REVIEW: { label: '要確認', tone: 'warning' },
  FAILED: { label: 'エラー', tone: 'negative' },
};

interface Issue {
  level: string;
  message: string;
}

/** 取込結果の詳細（§10）。行ごとの結果とロールバックを提供する。 */
export default async function ImportBatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'import:run');

  const { batchId } = await params;
  const { status } = await searchParams;
  const batch = await findBatch(ctx, batchId);
  if (!batch) notFound();

  const rows = await prisma.importRow.findMany({
    where: { batchId, ...(status ? { status: status as never } : {}) },
    orderBy: { rowNumber: 'asc' },
    take: 500,
  });

  const canRollback = can(ctx, 'import:manage') && batch.status === 'COMMITTED' && !batch.rolledBackAt;

  return (
    <>
      <Panel>
        <PanelHeader
          title={batch.fileName}
          description={`${formatDateTime(batch.createdAt)} / ${batch.importedBy?.name ?? '不明'} / ${batch.encoding}`}
          actions={
            batch.status === 'DRAFT' || batch.status === 'VALIDATED' ? (
              <Button asChild variant="primary" size="md">
                <Link href={`/import/${batch.id}/preview`}>取込を続ける</Link>
              </Button>
            ) : null
          }
        />
        <StatGrid columns={6}>
          <StatCard label="総行数" value={formatInt(batch.totalRows)} />
          <StatCard label="新規" value={formatInt(batch.createdCount)} tone="positive" />
          <StatCard label="更新" value={formatInt(batch.updatedCount)} />
          <StatCard label="重複" value={formatInt(batch.duplicateCount)} tone={batch.duplicateCount > 0 ? 'warning' : 'default'} />
          <StatCard label="エラー" value={formatInt(batch.failureCount)} tone={batch.failureCount > 0 ? 'negative' : 'default'} />
          <StatCard label="成功" value={formatInt(batch.successCount)} />
        </StatGrid>
        {canRollback ? (
          <PanelBody>
            <RollbackButton batchId={batch.id} />
          </PanelBody>
        ) : batch.rolledBackAt ? (
          <PanelBody>
            <p className="text-[12px] text-[var(--color-warning)]">
              この取込は {formatDateTime(batch.rolledBackAt)} にロールバック済みです。
            </p>
          </PanelBody>
        ) : null}
      </Panel>

      <Panel>
        <PanelHeader title={`取込行（最大 500 行を表示 / ${rows.length} 行）`} />
        <TableWrap>
          <Table className="min-w-[900px]">
            <thead>
              <tr>
                <Th align="right">行</Th>
                <Th>結果</Th>
                <Th>突合キー</Th>
                <Th>顧客</Th>
                <Th>契約</Th>
                <Th>指摘事項</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={6} message="行がありません。" />
              ) : (
                rows.map((row) => {
                  const meta = ROW_STATUS[row.status] ?? { label: row.status, tone: 'neutral' as BadgeTone };
                  const errors = (row.errors ?? []) as unknown as Issue[];
                  const warnings = (row.warnings ?? []) as unknown as Issue[];
                  return (
                    <Tr key={row.id}>
                      <Td numeric className="text-[var(--color-ink-subtle)]">{row.rowNumber}</Td>
                      <Td><Badge tone={meta.tone}>{meta.label}</Badge></Td>
                      <Td className="text-[11px] text-[var(--color-ink-muted)]">{row.matchedBy ?? '—'}</Td>
                      <Td>
                        {row.customerId ? (
                          <Link href={`/customers/${row.customerId}`} className="text-[var(--color-brand)] hover:underline">
                            顧客を開く
                          </Link>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td>
                        {row.contractId ? (
                          <Link href={`/contracts/${row.contractId}`} className="text-[var(--color-brand)] hover:underline">
                            契約を開く
                          </Link>
                        ) : (
                          '—'
                        )}
                      </Td>
                      <Td className="max-w-[420px]">
                        {errors.length === 0 && warnings.length === 0 ? (
                          <span className="text-[var(--color-ink-subtle)]">—</span>
                        ) : (
                          <ul className="text-[11px] leading-relaxed">
                            {errors.map((issue, i) => (
                              <li key={`e${i}`} className="text-[var(--color-negative)]">❌ {issue.message}</li>
                            ))}
                            {warnings.map((issue, i) => (
                              <li key={`w${i}`} className="text-[var(--color-warning)]">⚠️ {issue.message}</li>
                            ))}
                          </ul>
                        )}
                      </Td>
                    </Tr>
                  );
                })
              )}
            </tbody>
          </Table>
        </TableWrap>
      </Panel>
    </>
  );
}
