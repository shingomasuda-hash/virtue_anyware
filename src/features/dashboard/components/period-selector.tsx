'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { PeriodPreset } from '@/lib/date';

const PRESETS: Array<{ value: PeriodPreset; label: string }> = [
  { value: 'today', label: '今日' },
  { value: 'this_month', label: '今月' },
  { value: 'last_month', label: '先月' },
  { value: 'this_quarter', label: '今四半期' },
  { value: 'this_year', label: '今年' },
];

export function PeriodSelector({ current }: { current: PeriodPreset }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function select(preset: PeriodPreset) {
    const next = new URLSearchParams(params.toString());
    next.set('period', preset);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="inline-flex overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-white">
      {PRESETS.map((preset, index) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => select(preset.value)}
          className={cn(
            'px-2.5 py-1 text-[12px] text-[var(--color-ink-muted)] hover:bg-[var(--color-neutral-soft)]',
            index > 0 && 'border-l border-[var(--color-border)]',
            current === preset.value && 'bg-[var(--color-brand-soft)] font-medium text-[var(--color-brand)]',
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
