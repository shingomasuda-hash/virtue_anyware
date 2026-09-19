import * as React from 'react';
import { cn } from '@/lib/cn';

export interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'positive' | 'negative' | 'warning';
  className?: string;
}

/** KPI タイル。カード多用を避けるため、罫線で区切ったグリッドのセルとして使う。 */
export function StatCard({ label, value, sub, tone = 'default', className }: StatCardProps) {
  return (
    <div className={cn('flex flex-col gap-1 px-4 py-3', className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-subtle)]">{label}</span>
      <span
        className={cn(
          'num text-[20px] font-semibold leading-tight',
          tone === 'positive' && 'text-[var(--color-positive)]',
          tone === 'negative' && 'text-[var(--color-negative)]',
          tone === 'warning' && 'text-[var(--color-warning)]',
        )}
      >
        {value}
      </span>
      {sub ? <span className="text-[11px] text-[var(--color-ink-subtle)]">{sub}</span> : null}
    </div>
  );
}

export function StatGrid({ children, columns = 4 }: { children: React.ReactNode; columns?: 3 | 4 | 6 }) {
  return (
    <div
      className={cn(
        'panel grid divide-x divide-y divide-[var(--color-border)] [&>*]:min-w-0',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        columns === 6 && 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
      )}
    >
      {children}
    </div>
  );
}
