import * as React from 'react';

export function DefinitionList({ children, columns = 4 }: { children: React.ReactNode; columns?: 2 | 3 | 4 }) {
  const cols = columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4';
  return <dl className={`grid gap-3 ${cols}`}>{children}</dl>;
}

export function DefinitionRow({
  label,
  children,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  tone?: 'default' | 'muted' | 'warning' | 'negative';
}) {
  const valueClass =
    tone === 'warning'
      ? 'text-[var(--color-warning)]'
      : tone === 'negative'
        ? 'text-[var(--color-negative)]'
        : tone === 'muted'
          ? 'text-[var(--color-ink-subtle)]'
          : 'text-[var(--color-ink)]';
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-[var(--color-ink-subtle)]">{label}</dt>
      <dd className={`text-[13px] ${valueClass}`}>{children}</dd>
    </div>
  );
}
