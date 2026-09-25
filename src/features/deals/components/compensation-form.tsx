'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FieldError, FormError, SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import { formatYen } from '@/lib/format';
import { calcCompensation } from '@/server/services/deals/compensation';
import { COMPENSATION_PAYMENT_STATUS_LABELS, optionsOf } from '../labels';
import { saveDealCompensationAction } from '../actions';

export interface CompensationFormDefaults {
  equipmentCost?: string;
  constructionCost?: string;
  extendedWarrantyCost?: string;
  otherCost?: string;
  deductionAmount?: string;
  salesCommissionRate?: string;
  agencyCommissionRate?: string;
  paymentDueAt?: string | null;
  paidAt?: string | null;
  paymentStatus?: string;
  notes?: string | null;
}

type State = ActionResult<{ id: string }> | null;

/**
 * 報酬入力。
 *
 * 画面に出す金額は**入力中の目安**で、保存されるのはサーバー側で再計算した値（§34）。
 * 目安と保存値がずれないよう、計算にはサーバーと同じ `calcCompensation()` を使う。
 */
export function CompensationForm({
  dealId,
  dealCode,
  salesPriceExclTax,
  defaults,
  basePath,
}: {
  dealId: string;
  dealCode: string;
  salesPriceExclTax: number;
  defaults: CompensationFormDefaults;
  basePath: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    equipmentCost: defaults.equipmentCost ?? '0',
    constructionCost: defaults.constructionCost ?? '0',
    extendedWarrantyCost: defaults.extendedWarrantyCost ?? '0',
    otherCost: defaults.otherCost ?? '0',
    deductionAmount: defaults.deductionAmount ?? '0',
    salesCommissionRate: defaults.salesCommissionRate ?? '0',
    agencyCommissionRate: defaults.agencyCommissionRate ?? '0',
  });
  const [state, formAction] = useActionState<State, FormData>(
    async (prev, formData) => (await saveDealCompensationAction(prev, formData)) as State,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      router.push(`${basePath}/${dealId}`);
      router.refresh();
    }
  }, [state, router, basePath, dealId]);

  function set(key: keyof typeof values, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  let preview: ReturnType<typeof calcCompensation> | null = null;
  try {
    preview = calcCompensation({ salesPriceExclTax, ...values });
  } catch {
    preview = null;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="dealId" value={dealId} />
      <Panel>
        <PanelHeader
          title={`${dealCode} の報酬`}
          description={`販売価格（税抜） ${formatYen(salesPriceExclTax)}。原価・控除額・率を入力すると金額が計算されます。`}
        />
        <PanelBody className="flex flex-col gap-4">
          <FormError state={state} />

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="設備費 *">
              <Input name="equipmentCost" inputMode="numeric" required value={values.equipmentCost} onChange={(e) => set('equipmentCost', e.target.value)} />
              <FieldError state={state} name="equipmentCost" />
            </Field>
            <Field label="工事代 *">
              <Input name="constructionCost" inputMode="numeric" required value={values.constructionCost} onChange={(e) => set('constructionCost', e.target.value)} />
              <FieldError state={state} name="constructionCost" />
            </Field>
            <Field label="延長保証料 *">
              <Input name="extendedWarrantyCost" inputMode="numeric" required value={values.extendedWarrantyCost} onChange={(e) => set('extendedWarrantyCost', e.target.value)} />
              <FieldError state={state} name="extendedWarrantyCost" />
            </Field>
            <Field label="その他原価 *">
              <Input name="otherCost" inputMode="numeric" required value={values.otherCost} onChange={(e) => set('otherCost', e.target.value)} />
              <FieldError state={state} name="otherCost" />
            </Field>

            <Field label="控除額 *" hint="コミッション対象額から差し引く額">
              <Input name="deductionAmount" inputMode="numeric" required value={values.deductionAmount} onChange={(e) => set('deductionAmount', e.target.value)} />
              <FieldError state={state} name="deductionAmount" />
            </Field>
            <Field label="営業コミッション率 *" hint="30% なら 0.3">
              <Input name="salesCommissionRate" inputMode="decimal" required value={values.salesCommissionRate} onChange={(e) => set('salesCommissionRate', e.target.value)} />
              <FieldError state={state} name="salesCommissionRate" />
            </Field>
            <Field label="代理店コミッション率 *" hint="20% なら 0.2">
              <Input name="agencyCommissionRate" inputMode="decimal" required value={values.agencyCommissionRate} onChange={(e) => set('agencyCommissionRate', e.target.value)} />
              <FieldError state={state} name="agencyCommissionRate" />
            </Field>
          </div>

          <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-neutral-soft)] p-3">
            <p className="mb-2 text-[11px] text-[var(--color-ink-subtle)]">
              計算結果（保存時にサーバー側で再計算した値が保存されます）
            </p>
            {preview === null ? (
              <p className="text-[12px] text-[var(--color-negative)]">
                入力値が正しくないため計算できません。率は 0〜1、金額はマイナス不可です。
              </p>
            ) : (
              <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ['原価合計', preview.totalCost],
                  ['営業利益', preview.grossProfit],
                  ['コミッション対象額', preview.commissionBase],
                  ['営業コミッション', preview.salesCommission],
                  ['代理店コミッション', preview.agencyCommission],
                  ['会社残粗利', preview.companyGrossProfit],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex flex-col gap-0.5">
                    <dt className="text-[11px] text-[var(--color-ink-subtle)]">{label}</dt>
                    <dd className={`num text-[14px] font-semibold ${(value as number) < 0 ? 'text-[var(--color-negative)]' : ''}`}>
                      {formatYen(value as number)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {preview !== null && preview.commissionBase === 0 && preview.grossProfit <= 0 ? (
              <p className="mt-2 text-[11px] text-[var(--color-negative)]">
                営業利益が控除額を下回るため、コミッションは発生しません。
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 border-t border-[var(--color-border)] pt-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="支払状況 *">
              <Select name="paymentStatus" required defaultValue={defaults.paymentStatus ?? 'PENDING'}>
                {optionsOf(COMPENSATION_PAYMENT_STATUS_LABELS).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="支払予定日">
              <Input name="paymentDueAt" type="date" defaultValue={defaults.paymentDueAt ?? ''} />
            </Field>
            <Field label="支払日">
              <Input name="paidAt" type="date" defaultValue={defaults.paidAt ?? ''} />
            </Field>
          </div>

          <Field label="備考">
            <Textarea name="notes" rows={2} defaultValue={defaults.notes ?? ''} />
          </Field>

          <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
            <SubmitButton>保存する</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => router.back()}>キャンセル</Button>
          </div>
        </PanelBody>
      </Panel>
    </form>
  );
}
