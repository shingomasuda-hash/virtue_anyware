import { PageHeader } from '@/components/data/page-header';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/data/pagination';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';
import { orgScope } from '@/server/authz/scope';
import { prisma } from '@/server/db';
import { formatDateTime } from '@/lib/format';

const PAGE_SIZE = 50;

/** 誰がいつ何を変更したか（§27）。財務データは変更前後の値つきで表示する。 */
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ page?: string; entity?: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'audit:read');

  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? '1') || 1);
  const scope = orgScope(ctx);

  const where = {
    ...(scope.organizationId ? { organizationId: scope.organizationId } : {}),
    ...(params.entity ? { entity: params.entity } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { id: true, name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="監査ログ"
        description="顧客・契約・単価・代理店・CSV取込・キャンセルの変更履歴。財務データは変更前後の値を保持します。"
      />
      <Panel>
        <PanelHeader title={`${total} 件`} />
        <TableWrap>
          <Table className="min-w-[980px]">
            <thead>
              <tr>
                <Th>日時</Th>
                <Th>操作者</Th>
                <Th>ロール</Th>
                <Th>アクション</Th>
                <Th>対象</Th>
                <Th>変更前 → 変更後</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <EmptyRow colSpan={7} message="監査ログはまだありません。" />
              ) : (
                items.map((log) => (
                  <Tr key={log.id}>
                    <Td className="num whitespace-nowrap">{formatDateTime(log.createdAt)}</Td>
                    <Td>{log.actor?.name ?? '—'}</Td>
                    <Td className="text-[var(--color-ink-muted)]">{log.actorRole ?? '—'}</Td>
                    <Td><Badge tone="brand">{log.action}</Badge></Td>
                    <Td className="text-[var(--color-ink-muted)]">
                      {log.entity}
                      {log.entityId ? <span className="ml-1 text-[11px]">{log.entityId.slice(-8)}</span> : null}
                    </Td>
                    <Td className="max-w-[420px]">
                      <DiffCell before={log.before} after={log.after} />
                    </Td>
                    <Td className="num text-[11px] text-[var(--color-ink-subtle)]">{log.ipAddress ?? '—'}</Td>
                  </Tr>
                ))
              )}
            </tbody>
          </Table>
        </TableWrap>
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
          total={total}
          buildHref={(p) => `/settings/audit?page=${p}`}
        />
      </Panel>
    </>
  );
}

/** before / after のうち、実際に変化したキーだけを表示する。 */
function DiffCell({ before, after }: { before: unknown; after: unknown }) {
  const b = isRecord(before) ? before : null;
  const a = isRecord(after) ? after : null;
  if (!b && !a) return <span className="text-[var(--color-ink-subtle)]">—</span>;
  if (!b) return <span className="text-[11px] text-[var(--color-positive)]">新規作成</span>;
  if (!a) return <span className="text-[11px] text-[var(--color-negative)]">削除</span>;

  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(
    (k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]),
  );
  if (keys.length === 0) return <span className="text-[var(--color-ink-subtle)]">変更なし</span>;

  return (
    <ul className="text-[11px] leading-relaxed">
      {keys.slice(0, 6).map((key) => (
        <li key={key} className="truncate">
          <span className="text-[var(--color-ink-subtle)]">{key}:</span>{' '}
          <span className="text-[var(--color-negative)]">{format(b[key])}</span>
          {' → '}
          <span className="text-[var(--color-positive)]">{format(a[key])}</span>
        </li>
      ))}
      {keys.length > 6 ? <li className="text-[var(--color-ink-subtle)]">ほか {keys.length - 6} 項目</li> : null}
    </ul>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function format(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
