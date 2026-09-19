'use client';

import { useMemo, useState } from 'react';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { cn } from '@/lib/cn';
import type { PlannedRow, RowDecision } from '@/server/services/import/types';

const DECISION_META: Record<RowDecision | 'WARNING', { label: string; tone: BadgeTone; rowClass: string }> = {
  CREATE: { label: '新規登録', tone: 'positive', rowClass: 'bg-[var(--color-positive-soft)]/40' },
  UPDATE: { label: '更新', tone: 'brand', rowClass: 'bg-[var(--color-brand-soft)]/50' },
  DUPLICATE: { label: '重複', tone: 'warning', rowClass: 'bg-[var(--color-warning-soft)]/60' },
  ERROR: { label: 'エラー', tone: 'negative', rowClass: 'bg-[var(--color-negative-soft)]/60' },
  WARNING: { label: '警告', tone: 'warning', rowClass: 'bg-[var(--color-warning-soft)]/30' },
};

type Filter = 'ALL' | RowDecision | 'WARNING';

/**
 * STEP4/5: プレビューとエラー・重複確認。
 * 新規 / 更新 / 重複 / エラー / 警告 を色分けして表示する。
 */
export function PreviewTable({ rows, initialLimit = 50 }: { rows: PlannedRow[]; initialLimit?: number }) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [limit, setLimit] = useState(initialLimit);

  const counts = useMemo(() => {
    return {
      ALL: rows.length,
      CREATE: rows.filter((r) => r.decision === 'CREATE').length,
      UPDATE: rows.filter((r) => r.decision === 'UPDATE').length,
      DUPLICATE: rows.filter((r) => r.decision === 'DUPLICATE').length,
      ERROR: rows.filter((r) => r.decision === 'ERROR').length,
      WARNING: rows.filter((r) => r.issues.some((i) => i.level === 'warning')).length,
    } satisfies Record<Filter, number>;
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return rows;
    if (filter === 'WARNING') return rows.filter((r) => r.issues.some((i) => i.level === 'warning'));
    return rows.filter((r) => r.decision === filter);
  }, [rows, filter]);

  const visible = filtered.slice(0, limit);

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--color-border)] p-3">
        {(['ALL', 'CREATE', 'UPDATE', 'DUPLICATE', 'ERROR', 'WARNING'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFilter(key);
              setLimit(initialLimit);
            }}
            className={cn(
              'rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] px-2.5 py-1 text-[12px] text-[var(--color-ink-muted)] hover:bg-[var(--color-neutral-soft)]',
              filter === key && 'border-[var(--color-brand)] bg-[var(--color-brand-soft)] font-medium text-[var(--color-brand)]',
            )}
          >
            {key === 'ALL' ? 'すべて' : DECISION_META[key].label}
            <span className="num ml-1.5">{counts[key]}</span>
          </button>
        ))}
      </div>

      <TableWrap>
        <Table className="min-w-[1080px]">
          <thead>
            <tr>
              <Th align="right">行</Th>
              <Th>判定</Th>
              <Th>氏名</Th>
              <Th>契約番号</Th>
              <Th>電話番号</Th>
              <Th>代理店</Th>
              <Th align="right">ワット数</Th>
              <Th>契約日</Th>
              <Th>ステータス</Th>
              <Th>指摘事項</Th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <EmptyRow colSpan={10} message="該当する行がありません。" />
            ) : (
              visible.map((row) => {
                const hasWarning = row.issues.some((i) => i.level === 'warning');
                const meta = DECISION_META[row.decision];
                return (
                  <Tr
                    key={row.rowNumber}
                    className={cn(meta.rowClass, row.decision === 'CREATE' && hasWarning && DECISION_META.WARNING.rowClass)}
                  >
                    <Td numeric className="text-[var(--color-ink-subtle)]">{row.rowNumber}</Td>
                    <Td>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {hasWarning && row.decision !== 'ERROR' ? (
                        <Badge tone="warning" className="ml-1">警告</Badge>
                      ) : null}
                    </Td>
                    <Td>{str(row.values.customerName)}</Td>
                    <Td className="num">{str(row.values.contractNumber)}</Td>
                    <Td className="num">{str(row.values.phone)}</Td>
                    <Td className="text-[var(--color-ink-muted)]">{row.resolved.agencyLabel ?? '—'}</Td>
                    <Td numeric>{num(row.values.contractWatt)}</Td>
                    <Td className="num">{date(row.values.contractedAt)}</Td>
                    <Td className="text-[var(--color-ink-muted)]">{row.resolved.statusLabel ?? '—'}</Td>
                    <Td className="max-w-[360px]">
                      {row.issues.length === 0 ? (
                        <span className="text-[var(--color-ink-subtle)]">—</span>
                      ) : (
                        <ul className="text-[11px] leading-relaxed">
                          {row.issues.map((issue, index) => (
                            <li
                              key={`${row.rowNumber}-${index}`}
                              className={issue.level === 'error' ? 'text-[var(--color-negative)]' : 'text-[var(--color-warning)]'}
                            >
                              {issue.level === 'error' ? '❌' : '⚠️'} {issue.message}
                            </li>
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

      {filtered.length > visible.length ? (
        <div className="flex items-center justify-between px-4 py-2">
          <p className="text-[12px] text-[var(--color-ink-subtle)]">
            {visible.length} / {filtered.length} 行を表示中
          </p>
          <button
            type="button"
            onClick={() => setLimit((l) => l + 100)}
            className="rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] px-2 py-1 text-[12px] hover:bg-[var(--color-neutral-soft)]"
          >
            さらに 100 行を表示
          </button>
        </div>
      ) : (
        <p className="px-4 py-2 text-[12px] text-[var(--color-ink-subtle)]">{filtered.length} 行を表示中</p>
      )}
    </>
  );
}

function str(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function num(value: string | number | null | undefined): string {
  if (typeof value !== 'number') return str(value);
  return value.toLocaleString();
}

function date(value: string | number | null | undefined): string {
  if (typeof value !== 'string') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}
