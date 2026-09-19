'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FieldError, FormError, SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import { createAgencyAction, updateAgencyAction } from '../actions';

export interface AgencyFormDefaults {
  id?: string;
  code?: string;
  name?: string;
  corporateName?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  postalCode?: string | null;
  prefecture?: string | null;
  city?: string | null;
  address?: string | null;
  building?: string | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  paymentTerms?: string | null;
  bankName?: string | null;
  bankBranch?: string | null;
  bankAccountType?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolder?: string | null;
  notes?: string | null;
}

type State = ActionResult<{ id: string }> | null;

export function AgencyForm({ mode, defaults }: { mode: 'create' | 'edit'; defaults: AgencyFormDefaults }) {
  const router = useRouter();
  const action = mode === 'create' ? createAgencyAction : updateAgencyAction;
  const [state, formAction] = useActionState<State, FormData>(
    async (prev, formData) => (await action(prev, formData)) as State,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      router.push(`/agencies/${state.data.id}`);
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={formAction}>
      {mode === 'edit' && defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <Panel>
        <PanelHeader title={mode === 'create' ? '代理店を登録' : '代理店を編集'} />
        <PanelBody className="flex flex-col gap-4">
          <FormError state={state} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="代理店コード *" hint="組織内で一意">
              <Input name="code" required defaultValue={defaults.code ?? ''} />
              <FieldError state={state} name="code" />
            </Field>
            <Field label="代理店名 *">
              <Input name="name" required defaultValue={defaults.name ?? ''} />
              <FieldError state={state} name="name" />
            </Field>
            <Field label="法人名">
              <Input name="corporateName" defaultValue={defaults.corporateName ?? ''} />
            </Field>

            <Field label="担当者">
              <Input name="contactPerson" defaultValue={defaults.contactPerson ?? ''} />
            </Field>
            <Field label="電話番号">
              <Input name="phone" inputMode="tel" defaultValue={defaults.phone ?? ''} />
            </Field>
            <Field label="メール">
              <Input name="email" type="email" defaultValue={defaults.email ?? ''} />
              <FieldError state={state} name="email" />
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
            <Field label="ステータス *">
              <Select name="status" required defaultValue={defaults.status ?? 'ACTIVE'}>
                <option value="ACTIVE">稼働中</option>
                <option value="SUSPENDED">一時停止</option>
                <option value="INACTIVE">停止</option>
              </Select>
            </Field>

            <Field label="契約開始日">
              <Input name="contractStartDate" type="date" defaultValue={defaults.contractStartDate ?? ''} />
            </Field>
            <Field label="契約終了日">
              <Input name="contractEndDate" type="date" defaultValue={defaults.contractEndDate ?? ''} />
            </Field>
            <Field label="支払条件">
              <Input name="paymentTerms" placeholder="月末締め 翌月末払い" defaultValue={defaults.paymentTerms ?? ''} />
            </Field>

            <Field label="金融機関">
              <Input name="bankName" defaultValue={defaults.bankName ?? ''} />
            </Field>
            <Field label="支店">
              <Input name="bankBranch" defaultValue={defaults.bankBranch ?? ''} />
            </Field>
            <Field label="口座種別">
              <Input name="bankAccountType" placeholder="普通" defaultValue={defaults.bankAccountType ?? ''} />
            </Field>
            <Field label="口座番号">
              <Input name="bankAccountNumber" defaultValue={defaults.bankAccountNumber ?? ''} />
            </Field>
            <Field label="口座名義">
              <Input name="bankAccountHolder" defaultValue={defaults.bankAccountHolder ?? ''} />
            </Field>
          </div>

          <Field label="備考">
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
