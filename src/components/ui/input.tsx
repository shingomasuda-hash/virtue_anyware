import * as React from 'react';
import { cn } from '@/lib/cn';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-white px-2.5 text-[13px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-subtle)] focus:border-[var(--color-brand)] focus:outline-none disabled:bg-[var(--color-neutral-soft)]',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-white px-2 text-[13px] text-[var(--color-ink)] focus:border-[var(--color-brand)] focus:outline-none',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-white px-2.5 py-1.5 text-[13px] focus:border-[var(--color-brand)] focus:outline-none',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-[var(--color-ink-muted)]">
        {label}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-[var(--color-ink-subtle)]">{hint}</p> : null}
    </div>
  );
}
