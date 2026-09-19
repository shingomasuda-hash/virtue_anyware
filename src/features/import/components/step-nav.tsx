import { cn } from '@/lib/cn';

export const IMPORT_STEPS = [
  { key: 1, label: 'アップロード' },
  { key: 2, label: 'CSV解析' },
  { key: 3, label: '列マッピング' },
  { key: 4, label: 'プレビュー' },
  { key: 5, label: 'エラー・重複確認' },
  { key: 6, label: 'インポート確定' },
] as const;

export function StepNav({ current }: { current: number }) {
  return (
    <ol className="panel flex flex-wrap items-stretch divide-x divide-[var(--color-border)] overflow-hidden">
      {IMPORT_STEPS.map((step) => {
        const done = step.key < current;
        const active = step.key === current;
        return (
          <li
            key={step.key}
            className={cn(
              'flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-[12px]',
              active && 'bg-[var(--color-brand-soft)]',
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                active && 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white',
                done && 'border-[var(--color-positive)] bg-[var(--color-positive)] text-white',
                !active && !done && 'border-[var(--color-border-strong)] text-[var(--color-ink-subtle)]',
              )}
            >
              {done ? '✓' : step.key}
            </span>
            <span
              className={cn(
                'truncate',
                active ? 'font-medium text-[var(--color-brand)]' : 'text-[var(--color-ink-muted)]',
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
