import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABELS } from '@/server/authz/roles';
import type { UserRole } from '@/generated/prisma';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  agencyName: string | null;
  phone: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
}

export function UserTable({ rows, canManage }: { rows: UserRow[]; canManage: boolean }) {
  return (
    <TableWrap>
      <Table>
        <thead>
          <tr>
            <Th>氏名</Th>
            <Th>メールアドレス</Th>
            <Th>ロール</Th>
            <Th>所属代理店</Th>
            <Th>電話番号</Th>
            <Th>最終ログイン</Th>
            <Th>状態</Th>
            {canManage ? <Th>操作</Th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={canManage ? 8 : 7} message="ユーザーが登録されていません。" />
          ) : (
            rows.map((row) => (
              <Tr key={row.id}>
                <Td className="font-medium">{row.name}</Td>
                <Td className="text-[var(--color-ink-muted)]">{row.email}</Td>
                <Td>{ROLE_LABELS[row.role]}</Td>
                <Td className="text-[var(--color-ink-muted)]">{row.agencyName ?? '—'}</Td>
                <Td className="text-[var(--color-ink-muted)]">{row.phone ?? '—'}</Td>
                <Td className="whitespace-nowrap text-[12px] text-[var(--color-ink-muted)]">
                  {row.lastLoginAt ? formatDateTime(row.lastLoginAt) : '未ログイン'}
                </Td>
                <Td>
                  <Badge tone={row.isActive ? 'positive' : 'neutral'}>{row.isActive ? '有効' : '無効'}</Badge>
                </Td>
                {canManage ? (
                  <Td>
                    <Link href={`/users/${row.id}/edit`} className="text-[var(--color-brand)] hover:underline">
                      編集
                    </Link>
                  </Td>
                ) : null}
              </Tr>
            ))
          )}
        </tbody>
      </Table>
    </TableWrap>
  );
}
