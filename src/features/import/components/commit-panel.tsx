'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { StatCard, StatGrid } from '@/components/data/stat-card';
import { Button } from '@/components/ui/button';
import { FormError, SubmitButton } from '@/components/data/form-shell';
import { formatInt } from '@/lib/format';
import type { ActionResult } from '@/lib/action-result';
import type { ImportPlanSummary } from '@/server/services/import/types';
import { commitImportAction, dryRunAction } from '../actions';

type DryRunState = ActionResult<ImportPlanSummary> | null;
type CommitState = ActionResult<ImportPlanSummary & { successCount: number }> | null;

/**
 * STEP5/6: DRY RUN と取込確定。
 *
 * DRY RUN は顧客・契約へ一切書き込まず、件数だけを算出する。
 */
export function CommitPanel({ batchId, summary }: { batchId: string; summary: ImportPlanSummary }) {
  const router = useRouter();

  const [dryRunState, dryRunFormAction] = useActionState<DryRunState, FormData>(
    async (prev, formData) => (await dryRunAction(prev, formData)) as DryRunState,
    null,
  );

  const [commitState, commitFormAction] = useActionState<CommitState, FormData>(async (prev, formData) => {
    const result = (await commitImportAction(prev, formData)) as CommitState;
    if (result?.ok) router.refresh();
    return result;
  }, null);

  const shown = dryRunState?.ok ? dryRunState.data : summary;
  const committed = commitState?.ok ? commitState.data : null;

  if (committed) {
    return (
      <Panel>
        <PanelHeader title="取込が完了しました" description="結果は取込履歴からいつでも確認・ロールバックできます。" />
        <StatGrid columns={4}>
          <StatCard label="新規登録" value={formatInt(committed.createCount)} tone="positive" />
          <StatCard label="更新" value={formatInt(committed.updateCount)} />
          <StatCard label="重複（スキップ）" value={formatInt(committed.duplicateCount)} tone="warning" />
          <StatCard label="エラー（スキップ）" value={formatInt(committed.errorCount)} tone={committed.errorCount > 0 ? 'negative' : 'default'} />
        </StatGrid>
        <PanelBody className="flex items-center gap-2">
          <Button variant="primary" onClick={() => router.push('/customers')}>顧客一覧を見る</Button>
          <Button variant="secondary" onClick={() => router.push(`/import/history/${batchId}`)}>取込結果の詳細</Button>
          <Button variant="ghost" onClick={() => router.push('/import')}>続けて別の CSV を取り込む</Button>
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader
        title="DRY RUN と取込確定"
        description="DRY RUN はデータベースへ一切書き込まず、件数だけを試算します。"
      />
      <StatGrid columns={6}>
        <StatCard label="総行数" value={formatInt(shown.totalRows)} />
        <StatCard label="新規登録" value={formatInt(shown.createCount)} tone="positive" />
        <StatCard label="更新" value={formatInt(shown.updateCount)} />
        <StatCard label="重複" value={formatInt(shown.duplicateCount)} tone={shown.duplicateCount > 0 ? 'warning' : 'default'} />
        <StatCard label="エラー" value={formatInt(shown.errorCount)} tone={shown.errorCount > 0 ? 'negative' : 'default'} />
        <StatCard label="警告" value={formatInt(shown.warningCount)} tone={shown.warningCount > 0 ? 'warning' : 'default'} />
      </StatGrid>
      <PanelBody className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <form action={dryRunFormAction}>
            <input type="hidden" name="batchId" value={batchId} />
            <SubmitButton variant="primary">DRY RUN を実行</SubmitButton>
          </form>
          {dryRunState?.ok ? (
            <span className="text-[12px] text-[var(--color-positive)]">
              DRY RUN 完了。データベースへは書き込んでいません。
            </span>
          ) : null}
          <FormError state={dryRunState} />
        </div>

        <div className="border-t border-[var(--color-border)] pt-3">
          <p className="mb-2 text-[12px] text-[var(--color-ink-muted)]">
            確定すると、新規 {formatInt(shown.createCount)} 件・更新 {formatInt(shown.updateCount)} 件が登録されます。
            エラー行と重複行はスキップされ、理由が取込結果に記録されます。
            誤って取り込んだ場合は取込履歴からバッチ単位でロールバックできます。
          </p>
          <form action={commitFormAction} className="flex items-center gap-2">
            <input type="hidden" name="batchId" value={batchId} />
            <SubmitButton>取込を確定する</SubmitButton>
            <Button type="button" variant="ghost" onClick={() => router.push(`/import/${batchId}`)}>
              マッピングを修正する
            </Button>
          </form>
          <FormError state={commitState} />
        </div>
      </PanelBody>
    </Panel>
  );
}
