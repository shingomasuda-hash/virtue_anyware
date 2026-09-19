'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FieldError, FormError, SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import { createCustomerAction, updateCustomerAction } from '../actions';

export interface CustomerFormOption {
  value: string;
  label: string;
}

export interface CustomerFormDefaults {
  id?: string;
  agencyId?: string | null;
  externalCustomerId?: string | null;
  name?: string;
  nameKana?: string | null;
  phone?: string | null;
  email?: string | null;
  postalCode?: string | null;
  prefecture?: string | null;
  city?: string | null;
  address?: string | null;
  building?: string | null;
  birthDate?: string | null;
  assignedUserId?: string | null;
  notes?: string | null;
}

type State = ActionResult<{ id: string }> | null;

export function CustomerForm({
  mode,
  defaults,
  agencies,
  users,
  basePath,
  canChooseAgency,
}: {
  mode: 'create' | 'edit';
  defaults: CustomerFormDefaults;
  agencies: CustomerFormOption[];
  users: CustomerFormOption[];
  basePath: string;
  canChooseAgency: boolean;
}) {
  const router = useRouter();
  const action = mode === 'create' ? createCustomerAction : updateCustomerAction;
  const [state, formAction] = useActionState<State, FormData>(
    async (prev, formData) => (await action(prev, formData)) as State,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      router.push(`${basePath}/${state.data.id}`);
      router.refresh();
    }
  }, [state, router, basePath]);

  return (
    <form action={formAction}>
      {mode === 'edit' && defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <Panel>
        <PanelHeader
          title={mode === 'create' ? '顧客を登録' : '顧客情報を編集'}
          description="電話番号は重複チェックのキーとして正規化して保存されます。"
        />
        <PanelBody className="flex flex-col gap-4">
          <FormError state={state} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="氏名 *">
              <Input name="name" required defaultValue={defaults.name ?? ''} />
              <FieldError state={state} name="name" />
            </Field>
            <Field label="氏名カナ">
              <Input name="nameKana" defaultValue={defaults.nameKana ?? ''} />
            </Field>
            <Field label="顧客ID（外部）" hint="CSV 取込時の突合キー">
              <Input name="externalCustomerId" defaultValue={defaults.externalCustomerId ?? ''} />
            </Field>

            <Field label="電話番号">
              <Input name="phone" inputMode="tel" defaultValue={defaults.phone ?? ''} />
            </Field>
            <Field label="メール">
              <Input name="email" type="email" defaultValue={defaults.email ?? ''} />
              <FieldError state={state} name="email" />
            </Field>
            <Field label="生年月日">
              <Input name="birthDate" type="date" defaultValue={defaults.birthDate ?? ''} />
            </Field>

            <Field label="郵便番号">
              <Input name="postalCode" defaultValue={defaults.postalCode ?? ''} />
            </Field>
            <Field label="都道府県">
              <Input name="prefecture" defaultValue={defaults.prefecture ?? ''} />
            </Field>
            <Field label="市区町村">
              <Input name="city" defaultValue={defaults.city ?? ''} />
            </Field>

            <Field label="住所">
              <Input name="address" defaultValue={defaults.address ?? ''} />
            </Field>
            <Field label="建物名">
              <Input name="building" defaultValue={defaults.building ?? ''} />
            </Field>

            {canChooseAgency ? (
              <Field label="代理店" hint="代理店ユーザーは自社に固定されます">
                <Select name="agencyId" defaultValue={defaults.agencyId ?? ''}>
                  <option value="">未設定</option>
                  {agencies.map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field label="担当者">
              <Select name="assignedUserId" defaultValue={defaults.assignedUserId ?? ''}>
                <option value="">未設定</option>
                {users.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="メモ">
            <Textarea name="notes" rows={3} defaultValue={defaults.notes ?? ''} />
          </Field>

          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <SubmitButton>{mode === 'create' ? '登録する' : '保存する'}</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => router.back()}>キャンセル</Button>
          </div>
        </PanelBody>
      </Panel>
    </form>
  );
}
