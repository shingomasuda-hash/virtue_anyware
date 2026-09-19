'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormError, SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import type { RollbackResult } from '@/server/services/import/rollback';
import { rollbackImportAction } from '../actions';

type State = ActionResult<RollbackResult> | null;

/** バッチ単位のロールバック。取込後に人が変更したデータは巻き戻さない。 */
export function RollbackButton({ batchId }: { batchId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<State, FormData>(async (prev, formData) => {
    const result = (await rollbackImportAction(prev, formData)) as State;
    if (result?.ok) router.refresh();
    return result;
  }, null);

  if (state?.ok) {
    return (
      <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-neutral-soft)] px-3 py-2 text-[12px]">
        <p className="font-medium">ロールバックが完了しました。</p>
        <p className="mt-1 text-[var(--color-ink-muted)]">
          顧客 {state.data.deletedCustomers} 件を削除 / 契約 {state.data.deletedContracts} 件を削除 /
          {' '}{state.data.restoredRecords} 件を復元 / {state.data.skipped} 件をスキップ
        </p>
        {state.data.skipped > 0 ? (
          <ul className="mt-1 list-disc pl-4 text-[11px] text-[var(--color-warning)]">
            {state.data.rows
              .filter((r) => r.outcome === 'skipped')
              .slice(0, 5)
              .map((r) => (
                <li key={r.rowNumber}>行 {r.rowNumber}: {r.reason}</li>
              ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (!open) {
    return <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>この取込をロールバック</Button>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3">
      <input type="hidden" name="batchId" value={batchId} />
      <p className="text-[12px] text-[var(--color-ink-muted)]">
        この取込で<strong>新規作成された</strong>顧客・契約を削除し、<strong>更新された</strong>レコードを取込前の値へ戻します。
        取込後に人が変更したデータ、売上や精算が紐づいた契約は安全のため巻き戻しません。
      </p>
      <FormError state={state} />
      <div className="flex gap-2">
        <SubmitButton variant="danger">ロールバックを実行</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>やめる</Button>
      </div>
    </form>
  );
}
