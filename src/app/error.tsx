'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // 詳細はサーバーログのみに残し、クライアントへはスタックトレースを返さない（§31）
    console.error('[app] unhandled error', error.digest);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-[18px] font-semibold">エラーが発生しました</h1>
      <p className="max-w-md text-[13px] text-[var(--color-ink-muted)]">
        処理を完了できませんでした。操作をやり直しても解決しない場合は管理者へご連絡ください。
      </p>
      <Button variant="primary" onClick={reset}>再試行</Button>
    </div>
  );
}
