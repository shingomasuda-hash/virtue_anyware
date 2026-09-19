'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FieldError, FormError, SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import { createContractAction, updateContractAction } from '../actions';

export interface Option {
  value: string;
  label: string;
}

export interface ContractFormDefaults {
  id?: string;
  customerId?: string;
  productId?: string;
  agencyId?: string | null;
  contractNumber?: string | null;
  supplierId?: string | null;
  planId?: string | null;
  contractWatt?: string;
  statusId?: string;
  appliedAt?: string | null;
  contractedAt?: string | null;
  activatedAt?: string | null;
  eventId?: string | null;
  staffId?: string | null;
  campaign?: string | null;
  notes?: string | null;
}

type State = ActionResult<{ id: string; repriced?: boolean }> | null;

export function ContractForm({
  mode,
  defaults,
  customerName,
  options,
  basePath,
  canChooseAgency,
  agencies,
}: {
  mode: 'create' | 'edit';
  defaults: ContractFormDefaults;
  customerName: string;
  options: {
    products: Option[];
    suppliers: Option[];
    plans: Option[];
    statuses: Option[];
    events: Option[];
    staff: Option[];
  };
  basePath: string;
  canChooseAgency: boolean;
  agencies: Option[];
}) {
  const router = useRouter();
  const action = mode === 'create' ? createContractAction : updateContractAction;
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
      <input type="hidden" name="customerId" value={defaults.customerId ?? ''} />
      <Panel>
        <PanelHeader
          title={mode === 'create' ? '契約を登録' : '契約を編集'}
          description={`顧客: ${customerName} — 金額は契約日時点の単価マスタから自動計算され、契約行にスナップショット保存されます。`}
        />
        <PanelBody className="flex flex-col gap-4">
          <FormError state={state} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="契約番号">
              <Input name="contractNumber" defaultValue={defaults.contractNumber ?? ''} />
              <FieldError state={state} name="contractNumber" />
            </Field>
            <Field label="商材 *">
              <Select name="productId" required defaultValue={defaults.productId ?? ''}>
                <option value="">選択してください</option>
                {options.products.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
              <FieldError state={state} name="productId" />
            </Field>
            <Field label="契約ステータス *">
              <Select name="statusId" required defaultValue={defaults.statusId ?? ''}>
                <option value="">選択してください</option>
                {options.statuses.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
              <FieldError state={state} name="statusId" />
            </Field>

            <Field label="電力会社">
              <Select name="supplierId" defaultValue={defaults.supplierId ?? ''}>
                <option value="">未設定</option>
                {options.suppliers.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="契約プラン">
              <Select name="planId" defaultValue={defaults.planId ?? ''}>
                <option value="">未設定</option>
                {options.plans.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="契約ワット数 *" hint="半角数字。カンマは自動で除去されます。">
              <Input name="contractWatt" required inputMode="numeric" defaultValue={defaults.contractWatt ?? '0'} />
              <FieldError state={state} name="contractWatt" />
            </Field>

            <Field label="申込日">
              <Input name="appliedAt" type="date" defaultValue={defaults.appliedAt ?? ''} />
            </Field>
            <Field label="契約日" hint="単価の適用基準日になります">
              <Input name="contractedAt" type="date" defaultValue={defaults.contractedAt ?? ''} />
            </Field>
            <Field label="開通日">
              <Input name="activatedAt" type="date" defaultValue={defaults.activatedAt ?? ''} />
            </Field>

            {canChooseAgency ? (
              <Field label="代理店">
                <Select name="agencyId" defaultValue={defaults.agencyId ?? ''}>
                  <option value="">顧客の代理店を引き継ぐ</option>
                  {agencies.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="催事">
              <Select name="eventId" defaultValue={defaults.eventId ?? ''}>
                <option value="">未設定</option>
                {options.events.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="販売スタッフ">
              <Select name="staffId" defaultValue={defaults.staffId ?? ''}>
                <option value="">未設定</option>
                {options.staff.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="キャンペーン">
              <Input name="campaign" defaultValue={defaults.campaign ?? ''} />
            </Field>
          </div>

          <Field label="備考">
            <Textarea name="notes" rows={2} defaultValue={defaults.notes ?? ''} />
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
