'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FieldError, FormError, SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import type { DealPriority, DealProductType } from '@/generated/prisma';
import { DEAL_PAYMENT_METHODS, DEAL_PRIORITY_LABELS, DEAL_PRODUCT_TYPE_LABELS, PAYMENT_METHOD_LABELS } from '../labels';
import { createDealAction, updateDealAction } from '../actions';

export interface DealFormOption {
  id: string;
  name: string;
}

export interface DealFormOptions {
  statuses: DealFormOption[];
  agencies: DealFormOption[];
  staff: DealFormOption[];
  manufacturers: { id: string; name: string; categories: string[] }[];
  batteryModels: { id: string; name: string; capacity: string | null }[];
  financeCompanies: DealFormOption[];
  customers: { id: string; name: string; phone: string | null; externalCustomerId: string | null }[];
}

export interface DealFormDefaults {
  id?: string;
  code?: string | null;
  customerId?: string;
  agencyId?: string | null;
  statusId?: string;
  closerStaffId?: string | null;
  appointerStaffId?: string | null;
  productTypes?: DealProductType[];
  pvManufacturerId?: string | null;
  pvCapacityKw?: string | null;
  batteryManufacturerId?: string | null;
  batteryModelId?: string | null;
  batteryCapacityKwh?: string | null;
  equipmentManufacturerId?: string | null;
  metAt?: string | null;
  contractedAt?: string | null;
  salesPriceExclTax?: string | null;
  paymentMethod?: string | null;
  financeCompanyId?: string | null;
  lostReason?: string | null;
  nextActionAt?: string | null;
  priority?: DealPriority;
  notes?: string | null;
}

type State = ActionResult<{ id: string }> | null;

const ALL_PRODUCT_TYPES: DealProductType[] = ['PV', 'BT', 'EQ', 'IH'];

export function DealForm({
  mode,
  defaults,
  options,
  basePath,
  showAgencyField,
}: {
  mode: 'create' | 'edit';
  defaults: DealFormDefaults;
  options: DealFormOptions;
  basePath: string;
  showAgencyField: boolean;
}) {
  const router = useRouter();
  const action = mode === 'create' ? createDealAction : updateDealAction;
  const [productTypes, setProductTypes] = useState<DealProductType[]>(defaults.productTypes ?? []);
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

  function toggle(type: DealProductType) {
    setProductTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  const pvMakers = options.manufacturers.filter((m) => m.categories.includes('PV'));
  const btMakers = options.manufacturers.filter((m) => m.categories.includes('BATTERY'));
  const eqMakers = options.manufacturers.filter((m) => m.categories.includes('EQUIPMENT'));

  return (
    <form action={formAction}>
      {mode === 'edit' && defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {/* チェックボックスは未チェック時に送信されないため、1 つの文字列にまとめて送る */}
      <input type="hidden" name="productTypes" value={ALL_PRODUCT_TYPES.filter((t) => productTypes.includes(t)).join('.')} />

      <Panel>
        <PanelHeader title={mode === 'create' ? '案件を登録' : '案件を編集'} />
        <PanelBody className="flex flex-col gap-4">
          <FormError state={state} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="案件ID" hint={mode === 'create' ? '空欄なら自動採番（A0001 形式）' : undefined}>
              <Input name="code" defaultValue={defaults.code ?? ''} placeholder="A0041" />
              <FieldError state={state} name="code" />
            </Field>
            <Field label="顧客 *">
              <Select name="customerId" required defaultValue={defaults.customerId ?? ''}>
                <option value="">（選択してください）</option>
                {options.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.externalCustomerId, c.name, c.phone].filter(Boolean).join(' / ')}
                  </option>
                ))}
              </Select>
              <FieldError state={state} name="customerId" />
            </Field>
            <Field label="案件ステータス *">
              <Select name="statusId" required defaultValue={defaults.statusId ?? ''}>
                <option value="">（選択してください）</option>
                {options.statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <FieldError state={state} name="statusId" />
            </Field>
            <Field label="優先度 *">
              <Select name="priority" required defaultValue={defaults.priority ?? 'MEDIUM'}>
                {Object.entries(DEAL_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>

            {showAgencyField ? (
              <Field label="代理店" hint="未選択は自社直販">
                <Select name="agencyId" defaultValue={defaults.agencyId ?? ''}>
                  <option value="">自社（直販）</option>
                  {options.agencies.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="営業（CL）">
              <Select name="closerStaffId" defaultValue={defaults.closerStaffId ?? ''}>
                <option value="">（未選択）</option>
                {options.staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="アポ担当（AP）">
              <Select name="appointerStaffId" defaultValue={defaults.appointerStaffId ?? ''}>
                <option value="">（未選択）</option>
                {options.staff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="商談日">
              <Input name="metAt" type="date" defaultValue={defaults.metAt ?? ''} />
            </Field>
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <p className="mb-2 text-[12px] font-medium text-[var(--color-ink-muted)]">商材 *</p>
            <div className="flex flex-wrap gap-3">
              {ALL_PRODUCT_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-1.5 text-[13px]">
                  <input
                    type="checkbox"
                    checked={productTypes.includes(type)}
                    onChange={() => toggle(type)}
                    className="h-3.5 w-3.5"
                  />
                  {DEAL_PRODUCT_TYPE_LABELS[type]}（{type}）
                </label>
              ))}
            </div>
            <FieldError state={state} name="productTypes" />

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="太陽光メーカー">
                <Select name="pvManufacturerId" defaultValue={defaults.pvManufacturerId ?? ''}>
                  <option value="">（未選択）</option>
                  {pvMakers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="PV容量（kW）">
                <Input name="pvCapacityKw" inputMode="decimal" defaultValue={defaults.pvCapacityKw ?? ''} />
                <FieldError state={state} name="pvCapacityKw" />
              </Field>
              <Field label="蓄電池メーカー">
                <Select name="batteryManufacturerId" defaultValue={defaults.batteryManufacturerId ?? ''}>
                  <option value="">（未選択）</option>
                  {btMakers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="蓄電池型式">
                <Select name="batteryModelId" defaultValue={defaults.batteryModelId ?? ''}>
                  <option value="">（未選択）</option>
                  {options.batteryModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}{m.capacity ? `（${m.capacity} kWh）` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="蓄電池容量（kWh）">
                <Input name="batteryCapacityKwh" inputMode="decimal" defaultValue={defaults.batteryCapacityKwh ?? ''} />
                <FieldError state={state} name="batteryCapacityKwh" />
              </Field>
              <Field label="設備（EQ）メーカー">
                <Select name="equipmentManufacturerId" defaultValue={defaults.equipmentManufacturerId ?? ''}>
                  <option value="">（未選択）</option>
                  {eqMakers.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          <div className="grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="契約日">
              <Input name="contractedAt" type="date" defaultValue={defaults.contractedAt ?? ''} />
            </Field>
            <Field label="販売価格（税抜）" hint="報酬計算の基準になります">
              <Input name="salesPriceExclTax" inputMode="numeric" defaultValue={defaults.salesPriceExclTax ?? ''} />
              <FieldError state={state} name="salesPriceExclTax" />
            </Field>
            <Field label="支払方法">
              <Select name="paymentMethod" defaultValue={defaults.paymentMethod ?? ''}>
                <option value="">（未選択）</option>
                {DEAL_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
                ))}
              </Select>
            </Field>
            <Field label="信販会社">
              <Select name="financeCompanyId" defaultValue={defaults.financeCompanyId ?? ''}>
                <option value="">（未選択）</option>
                {options.financeCompanies.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </Select>
            </Field>

            <Field label="次回アクション日">
              <Input name="nextActionAt" type="date" defaultValue={defaults.nextActionAt ?? ''} />
            </Field>
            <Field label="失注理由" hint="失注・キャンセル時に記録">
              <Input name="lostReason" defaultValue={defaults.lostReason ?? ''} />
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
