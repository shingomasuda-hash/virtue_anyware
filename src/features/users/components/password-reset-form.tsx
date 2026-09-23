'use client';

import { useActionState } from 'react';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Field, Input } from '@/components/ui/input';
import { FieldError, FormError, SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import { describePasswordPolicy } from '@/lib/password';
import { resetUserPasswordAction } from '../actions';

type State = ActionResult<{ id: string }> | null;

export function PasswordResetForm({ userId, userName }: { userId: string; userName: string }) {
  const [state, formAction] = useActionState<State, FormData>(
    async (prev, formData) => (await resetUserPasswordAction(prev, formData)) as State,
    null,
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={userId} />
      <Panel>
        <PanelHeader
          title="パスワードを再設定"
          description={`${userName} さんの全セッションが失効します。新しいパスワードは安全な方法で本人へ伝えてください。`}
        />
        <PanelBody className="flex flex-col gap-4">
          <FormError state={state} />
          {state?.ok ? (
            <p className="rounded-[var(--radius-sm)] border border-[#abefc6] bg-[var(--color-positive-soft)] px-3 py-2 text-[12px] text-[var(--color-positive)]">
              パスワードを再設定しました。
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="新しいパスワード *" hint={describePasswordPolicy()}>
              <Input name="password" type="password" required autoComplete="new-password" />
              <FieldError state={state} name="password" />
            </Field>
            <Field label="新しいパスワード（確認） *">
              <Input name="passwordConfirm" type="password" required autoComplete="new-password" />
              <FieldError state={state} name="passwordConfirm" />
            </Field>
          </div>

          <div className="border-t border-[var(--color-border)] pt-3">
            <SubmitButton variant="danger">再設定する</SubmitButton>
          </div>
        </PanelBody>
      </Panel>
    </form>
  );
}
