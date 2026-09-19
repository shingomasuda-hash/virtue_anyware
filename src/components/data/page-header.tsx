import * as React from 'react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] pb-4">
      <div className="min-w-0">
        <h1 className="text-[18px] font-semibold tracking-tight text-[var(--color-ink)]">{title}</h1>
        {description ? <p className="mt-1 text-[13px] text-[var(--color-ink-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
