'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { NavSection } from './nav-config';

export function Sidebar({ sections, organizationName }: { sections: NavSection[]; organizationName: string }) {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-full flex-col border-r border-[var(--color-border)] bg-white">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-4">
        <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand)] text-[11px] font-bold text-white">
          V
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold leading-tight">VIRTUE Sales OS</p>
          <p className="truncate text-[10px] text-[var(--color-ink-subtle)]">{organizationName}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => (
          <div key={section.title} className="mb-1 px-2">
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-subtle)]">
              {section.title}
            </p>
            <ul>
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center justify-between gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-[13px] text-[var(--color-ink-muted)] hover:bg-[var(--color-neutral-soft)]',
                        active && 'bg-[var(--color-brand-soft)] font-medium text-[var(--color-brand)]',
                      )}
                    >
                      <span className="truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="shrink-0 rounded-[var(--radius-xs)] border border-[var(--color-border)] px-1 text-[9px] text-[var(--color-ink-subtle)]">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
