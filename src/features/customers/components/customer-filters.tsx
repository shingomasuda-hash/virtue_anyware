'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';

export interface FilterOption {
  value: string;
  label: string;
}

export interface CustomerFilterValues {
  name: string;
  phone: string;
  contractNumber: string;
  agencyId: string;
  assignedUserId: string;
  prefecture: string;
  contractStatusId: string;
  upsellStatusId: string;
  contractedFrom: string;
  contractedTo: string;
}

/** 複数条件を組み合わせられる検索フォーム（§11）。 */
export function CustomerFilters({
  initial,
  agencies,
  users,
  prefectures,
  contractStatuses,
  upsellStatuses,
  showAgencyFilter,
}: {
  initial: CustomerFilterValues;
  agencies: FilterOption[];
  users: FilterOption[];
  prefectures: FilterOption[];
  contractStatuses: FilterOption[];
  upsellStatuses: FilterOption[];
  showAgencyFilter: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [values, setValues] = useState<CustomerFilterValues>(initial);

  function set<K extends keyof CustomerFilterValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
    }
    const pageSize = params.get('pageSize');
    if (pageSize) next.set('pageSize', pageSize);
    router.push(`${pathname}?${next.toString()}`);
  }

  function reset() {
    router.push(pathname);
  }

  return (
    <form onSubmit={submit} className="border-b border-[var(--color-border)] p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <Field label="顧客名 / カナ">
          <Input value={values.name} onChange={(e) => set('name', e.target.value)} placeholder="山田 太郎" />
        </Field>
        <Field label="電話番号">
          <Input value={values.phone} onChange={(e) => set('phone', e.target.value)} placeholder="090…" inputMode="tel" />
        </Field>
        <Field label="契約番号">
          <Input value={values.contractNumber} onChange={(e) => set('contractNumber', e.target.value)} />
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
        <Field label="担当者">
          <Select value={values.assignedUserId} onChange={(e) => set('assignedUserId', e.target.value)}>
            <option value="">すべて</option>
            {users.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="都道府県">
          <Select value={values.prefecture} onChange={(e) => set('prefecture', e.target.value)}>
            <option value="">すべて</option>
            {prefectures.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="契約ステータス">
          <Select value={values.contractStatusId} onChange={(e) => set('contractStatusId', e.target.value)}>
            <option value="">すべて</option>
            {contractStatuses.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>
        </Field>
        {upsellStatuses.length > 0 ? (
          <Field label="アップセルステータス">
            <Select value={values.upsellStatusId} onChange={(e) => set('upsellStatusId', e.target.value)}>
              <option value="">すべて</option>
              {upsellStatuses.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label="契約日（開始）">
          <Input type="date" value={values.contractedFrom} onChange={(e) => set('contractedFrom', e.target.value)} />
        </Field>
        <Field label="契約日（終了）">
          <Input type="date" value={values.contractedTo} onChange={(e) => set('contractedTo', e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button type="submit" variant="primary" size="sm">検索</Button>
        <Button type="button" variant="ghost" size="sm" onClick={reset}>条件をクリア</Button>
      </div>
    </form>
  );
}
