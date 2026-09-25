'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { DEAL_PRODUCT_TYPE_LABELS } from '../labels';

export interface DealFilterOption {
  value: string;
  label: string;
}

export interface DealFilterValues {
  q: string;
  statusId: string;
  productType: string;
  agencyId: string;
  closerStaffId: string;
  open: string;
  overdue: string;
}

export function DealFilters({
  initial,
  statuses,
  agencies,
  closers,
  showAgencyFilter,
}: {
  initial: DealFilterValues;
  statuses: DealFilterOption[];
  agencies: DealFilterOption[];
  closers: DealFilterOption[];
  showAgencyFilter: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [values, setValues] = useState<DealFilterValues>(initial);

  function set<K extends keyof DealFilterValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
    }
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <form onSubmit={submit} className="border-b border-[var(--color-border)] p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="案件ID / 顧客名 / 電話">
          <Input value={values.q} onChange={(e) => set('q', e.target.value)} placeholder="A0001 / 佐藤" />
        </Field>
        <Field label="案件ステータス">
          <Select value={values.statusId} onChange={(e) => set('statusId', e.target.value)}>
            <option value="">すべて</option>
            {statuses.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="商材">
          <Select value={values.productType} onChange={(e) => set('productType', e.target.value)}>
            <option value="">すべて</option>
            {Object.entries(DEAL_PRODUCT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        {showAgencyFilter ? (
          <Field label="代理店">
            <Select value={values.agencyId} onChange={(e) => set('agencyId', e.target.value)}>
              <option value="">すべて</option>
              {agencies.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="営業（CL）">
          <Select value={values.closerStaffId} onChange={(e) => set('closerStaffId', e.target.value)}>
            <option value="">すべて</option>
            {closers.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="進行状況">
          <Select value={values.open} onChange={(e) => set('open', e.target.value)}>
            <option value="">すべて</option>
            <option value="1">進行中のみ</option>
          </Select>
        </Field>
        <Field label="次回アクション">
          <Select value={values.overdue} onChange={(e) => set('overdue', e.target.value)}>
            <option value="">すべて</option>
            <option value="1">期限超過のみ</option>
          </Select>
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" variant="primary" size="md">検索</Button>
        <Button type="button" variant="ghost" onClick={() => router.push(pathname)}>条件をクリア</Button>
      </div>
    </form>
  );
}
