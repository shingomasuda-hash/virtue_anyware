import * as React from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'brand' | 'positive' | 'warning' | 'negative';

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-[var(--color-neutral-soft)] text-[var(--color-ink-muted)] border-[var(--color-border)]',
  brand: 'bg-[var(--color-brand-soft)] text-[var(--color-brand)] border-[#c9d9fb]',
  positive: 'bg-[var(--color-positive-soft)] text-[var(--color-positive)] border-[#abefc6]',
  warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)] border-[#fedf89]',
  negative: 'bg-[var(--color-negative-soft)] text-[var(--color-negative)] border-[#fecdca]',
};

/** ステータスマスタの color 値を表示トーンへ写像する。 */
export function toneFromColor(color: string): BadgeTone {
  switch (color) {
    case 'blue':
      return 'brand';
    case 'green':
      return 'positive';
    case 'amber':
    case 'yellow':
      return 'warning';
    case 'red':
      return 'negative';
    default:
      return 'neutral';
  }
}

export function Badge({ tone = 'neutral', className, children }: { tone?: BadgeTone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--radius-xs)] border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
