'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { FormError, SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import { cancelContractAction, repriceContractAction } from '../actions';

type State = ActionResult<{ id: string }> | null;

/** 契約のキャンセル。キャンセル後は集計（売上・支払・粗利）から除外される。 */
export function CancelContractForm({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<State, FormData>(async (prev, formData) => {
    const result = (await cancelContractAction(prev, formData)) as State;
    if (result?.ok) router.refresh();
    return result;
  }, null);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        契約をキャンセル
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
      <input type="hidden" name="id" value={contractId} />
      <FormError state={state} />
      <Field label="キャンセル理由 *">
        <Input name="reason" required placeholder="顧客都合による解約" />
      </Field>
      <div className="flex gap-2">
        <SubmitButton variant="danger">キャンセルを確定</SubmitButton>
        <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)}>やめる</Button>
      </div>
    </form>
  );
}

/**
 * 単価の再適用。通常は実行しない操作。
 * 実行すると現在の単価マスタで再計算し、新しいスナップショットを追加する。
 */
export function RepriceContractForm({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<State, FormData>(async (prev, formData) => {
    const result = (await repriceContractAction(prev, formData)) as State;
    if (result?.ok) router.refresh();
    return result;
  }, null);

  if (!open) {
    return (
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        単価を再適用
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
      <input type="hidden" name="id" value={contractId} />
      <FormError state={state} />
      <p className="text-[11px] text-[var(--color-ink-subtle)]">
        現在の単価マスタで再計算し、新しいスナップショットを追加します。過去の履歴は残ります。
      </p>
      <Field label="再適用の理由 *">
        <Input name="reason" required placeholder="単価改定の遡及適用" />
      </Field>
      <div className="flex gap-2">
        <SubmitButton>再適用する</SubmitButton>
        <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)}>やめる</Button>
      </div>
    </form>
  );
}
