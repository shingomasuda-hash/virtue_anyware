import Link from 'next/link';
import { PageHeader } from '@/components/data/page-header';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';

const TABS = [
  { href: '/import', label: '新規インポート' },
  { href: '/import/history', label: 'インポート履歴' },
  { href: '/import/templates', label: 'CSVテンプレート' },
];

/**
 * CSV インポート画面。
 * 代理店ユーザーは HQ レイアウトへ入れないうえ、ここでも import:run を要求する。
 */
export default async function ImportLayout({ children }: { children: React.ReactNode }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'import:run');

  return (
    <>
      <PageHeader
        title="CSVインポート"
        description="電力会社・精算・催事などの CSV を取り込みます。列名が異なる CSV でもマッピングで対応できます。"
      />
      <nav className="flex items-center gap-1.5 border-b border-[var(--color-border)] pb-2">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-[var(--radius-sm)] px-2.5 py-1 text-[13px] text-[var(--color-ink-muted)] hover:bg-[var(--color-neutral-soft)]"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
