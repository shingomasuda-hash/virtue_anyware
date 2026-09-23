'use client';

import { useActionState } from 'react';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Field, Input } from '@/components/ui/input';
import { FieldError, FormError, SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import { describePasswordPolicy } from '@/lib/password';
import { changePasswordAction } from '../actions';

type State = ActionResult<{ changed: true }> | null;

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<State, FormData>(
    async (prev, formData) => (await changePasswordAction(prev, formData)) as State,
    null,
  );

  return (
    <form action={formAction}>
      <Panel>
        <PanelHeader
          title="パスワードを変更"
          description="変更すると、この端末以外のログインはすべて解除されます。"
        />
        <PanelBody className="flex flex-col gap-4">
          <FormError state={state} />
          {state?.ok ? (
            <p className="rounded-[var(--radius-sm)] border border-[#abefc6] bg-[var(--color-positive-soft)] px-3 py-2 text-[12px] text-[var(--color-positive)]">
              パスワードを変更しました。次回のログインから新しいパスワードを使用してください。
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="現在のパスワード *">
              <Input name="currentPassword" type="password" required autoComplete="current-password" />
              <FieldError state={state} name="currentPassword" />
            </Field>
            <Field label="新しいパスワード *" hint={describePasswordPolicy()}>
              <Input name="newPassword" type="password" required autoComplete="new-password" />
              <FieldError state={state} name="newPassword" />
            </Field>
            <Field label="新しいパスワード（確認） *">
              <Input name="newPasswordConfirm" type="password" required autoComplete="new-password" />
              <FieldError state={state} name="newPasswordConfirm" />
            </Field>
          </div>

          <div className="border-t border-[var(--color-border)] pt-3">
            <SubmitButton>変更する</SubmitButton>
          </div>
        </PanelBody>
      </Panel>
    </form>
  );
}
