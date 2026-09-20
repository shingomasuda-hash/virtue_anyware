'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface HealthCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  detail: string;
  hint?: string;
}

/**
 * 画面エラーの共通表示。
 *
 * スタックトレースはクライアントへ返さない（§31）が、
 * 原因の切り分けができないと運用できないため、
 *   ・Vercel のログと突き合わせられる digest
 *   ・設定不備なら /api/health の診断結果
 * を表示する。健全性チェックは秘密情報を含まない。
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [failedChecks, setFailedChecks] = useState<HealthCheck[] | null>(null);

  useEffect(() => {
    // 詳細はサーバーログのみに残す
    console.error('[app] unhandled error', error.digest);

    // 設定不備が原因なら、その場で何が足りないかを示す
    let cancelled = false;
    void fetch('/api/health', { cache: 'no-store' })
      .then((res) => res.json() as Promise<{ checks?: HealthCheck[] }>)
      .then((data) => {
        if (cancelled) return;
        const failures = (data.checks ?? []).filter((c) => c.status === 'error');
        if (failures.length > 0) setFailedChecks(failures);
      })
      .catch(() => {
        /* 診断に失敗しても画面は壊さない */
      });
    return () => {
      cancelled = true;
    };
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-[18px] font-semibold">エラーが発生しました</h1>
      <p className="text-[13px] text-[var(--color-ink-muted)]">
        処理を完了できませんでした。操作をやり直しても解決しない場合は管理者へご連絡ください。
      </p>

      {failedChecks ? (
        <div className="w-full rounded-[var(--radius-md)] border border-[#fecdca] bg-[var(--color-negative-soft)] p-4 text-left">
          <p className="text-[13px] font-medium text-[var(--color-negative)]">
            セットアップが完了していません
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {failedChecks.map((check) => (
              <li key={check.name} className="text-[12px]">
                <span className="font-medium">{check.name}</span>
                <span className="text-[var(--color-ink-muted)]">: {check.detail}</span>
                {check.hint ? (
                  <p className="mt-0.5 text-[11px] text-[var(--color-ink-subtle)]">{check.hint}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={reset}>再試行</Button>
        <Button variant="secondary" onClick={() => window.open('/api/health', '_blank')}>
          診断結果を見る
        </Button>
      </div>

      {error.digest ? (
        <p className="num text-[11px] text-[var(--color-ink-subtle)]">
          エラーID: {error.digest}
          <span className="ml-1">（サーバーログの照合に使用します）</span>
        </p>
      ) : null}
    </div>
  );
}
