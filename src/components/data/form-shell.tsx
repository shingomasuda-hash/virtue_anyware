'use client';

import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import type { ActionResult } from '@/lib/action-result';

export function SubmitButton({ children = '保存', variant = 'primary' as const }: { children?: React.ReactNode; variant?: 'primary' | 'danger' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="md" disabled={pending}>
      {pending ? '処理中…' : children}
    </Button>
  );
}

export function FormError({ state }: { state: ActionResult<unknown> | null }) {
  if (!state || state.ok) return null;
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-sm)] border border-[#fecdca] bg-[var(--color-negative-soft)] px-3 py-2 text-[12px] text-[var(--color-negative)]"
    >
      <p className="font-medium">{state.error}</p>
      {state.fieldErrors ? (
        <ul className="mt-1 list-disc pl-4">
          {Object.entries(state.fieldErrors).map(([field, messages]) => (
            <li key={field}>{messages.join(' / ')}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function FieldError({ state, name }: { state: ActionResult<unknown> | null; name: string }) {
  if (!state || state.ok || !state.fieldErrors?.[name]) return null;
  return <p className="text-[11px] text-[var(--color-negative)]">{state.fieldErrors[name].join(' / ')}</p>;
}
