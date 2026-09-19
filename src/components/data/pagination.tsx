import Link from 'next/link';
import { cn } from '@/lib/cn';

export function Pagination({
  page,
  pageCount,
  total,
  buildHref,
}: {
  page: number;
  pageCount: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  if (pageCount <= 1) {
    return <p className="px-4 py-2 text-[12px] text-[var(--color-ink-subtle)]">全 {total} 件</p>;
  }
  const prev = Math.max(1, page - 1);
  const next = Math.min(pageCount, page + 1);
  const linkClass = 'rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] px-2 py-1 text-[12px] hover:bg-[var(--color-neutral-soft)]';

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <p className="text-[12px] text-[var(--color-ink-subtle)]">
        全 {total} 件 / {page} ページ目（全 {pageCount} ページ）
      </p>
      <div className="flex items-center gap-1.5">
        <Link href={buildHref(prev)} className={cn(linkClass, page === 1 && 'pointer-events-none opacity-40')}>
          前へ
        </Link>
        <Link href={buildHref(next)} className={cn(linkClass, page === pageCount && 'pointer-events-none opacity-40')}>
          次へ
        </Link>
      </div>
    </div>
  );
}
