import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-[13px] font-medium text-[var(--color-ink-subtle)]">404</p>
      <h1 className="text-[18px] font-semibold">ページが見つかりません</h1>
      <p className="max-w-md text-[13px] text-[var(--color-ink-muted)]">
        URL が正しくないか、このデータへアクセスする権限がありません。
      </p>
      <Link href="/" className="text-[13px] text-[var(--color-brand)] hover:underline">
        トップへ戻る
      </Link>
    </div>
  );
}
