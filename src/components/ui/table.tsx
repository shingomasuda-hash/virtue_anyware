import * as React from 'react';
import { cn } from '@/lib/cn';

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('w-full overflow-x-auto', className)}>{children}</div>;
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return <table className={cn('w-full min-w-[720px] text-[13px]', className)}>{children}</table>;
}

export function Th({ children, className, align = 'left' }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      className={cn(
        'sticky top-0 z-10 border-b border-[var(--color-border)] bg-[var(--color-neutral-soft)] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-subtle)]',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className, align = 'left', numeric = false }: { children?: React.ReactNode; className?: string; align?: 'left' | 'right' | 'center'; numeric?: boolean }) {
  return (
    <td
      className={cn(
        'border-b border-[var(--color-border)] px-3 py-2 align-middle text-[var(--color-ink)]',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        numeric && 'num text-right',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return <tr className={cn('hover:bg-[var(--color-brand-soft)]/40', className)}>{children}</tr>;
}

export function EmptyRow({ colSpan, message = 'データがありません。' }: { colSpan: number; message?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-10 text-center text-[13px] text-[var(--color-ink-subtle)]">
        {message}
      </td>
    </tr>
  );
}
