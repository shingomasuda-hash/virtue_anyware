'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { FieldError, FormError, SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import { addAgencyUnitPriceAction } from '../actions';

type State = ActionResult<{ id: string }> | null;

/**
 * 代理店単価の追加（§5）。
 * 適用開始日より前から続く単価は、自動的に前日で締められる。
 */
export function UnitPriceForm({
  agencyId,
  products,
}: {
  agencyId: string;
  products: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<State, FormData>(async (prev, formData) => {
    const result = (await addAgencyUnitPriceAction(prev, formData)) as State;
    if (result?.ok) {
      setOpen(false);
      router.refresh();
    }
    return result;
  }, null);

  if (!open) {
    return (
      <div className="flex justify-end border-t border-[var(--color-border)] px-4 py-2">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>単価を追加</Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="w-full border-t border-[var(--color-border)] p-4">
      <input type="hidden" name="agencyId" value={agencyId} />
      <FormError state={state} />
      <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label="適用開始日 *">
          <Input name="effectiveFrom" type="date" required />
          <FieldError state={state} name="effectiveFrom" />
        </Field>
        <Field label="適用終了日" hint="空欄なら現行">
          <Input name="effectiveTo" type="date" />
        </Field>
        <Field label="商材">
          <Select name="productId" defaultValue="">
            <option value="">全商材</option>
            {products.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="単位 *">
          <Select name="unitType" defaultValue="PER_WATT" required>
            <option value="PER_WATT">円/W</option>
            <option value="PER_CONTRACT">円/件</option>
            <option value="PERCENT_OF_AMOUNT">販売額比率</option>
            <option value="FIXED">定額</option>
          </Select>
        </Field>
        <Field label="単価 *">
          <Input name="unitPrice" required inputMode="decimal" placeholder="100" />
          <FieldError state={state} name="unitPrice" />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <SubmitButton>追加する</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>やめる</Button>
        <p className="text-[11px] text-[var(--color-ink-subtle)]">
          既存契約の金額は変わりません（契約時点のスナップショットで保護されています）。
        </p>
      </div>
    </form>
  );
}
