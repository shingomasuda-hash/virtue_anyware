import * as React from 'react';
import { cn } from '@/lib/cn';

export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('panel', className)}>{children}</section>;
}

export function PanelHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <header className="panel-header">
      <div className="min-w-0">
        <h2 className="panel-title">{title}</h2>
        {description ? <p className="mt-0.5 text-[12px] text-[var(--color-ink-subtle)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function PanelBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('p-4', className)}>{children}</div>;
}
