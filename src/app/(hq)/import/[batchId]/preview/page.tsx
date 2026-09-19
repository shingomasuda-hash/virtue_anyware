import { notFound } from 'next/navigation';
import { Panel, PanelHeader } from '@/components/ui/panel';
import { StepNav } from '@/features/import/components/step-nav';
import { PreviewTable } from '@/features/import/components/preview-table';
import { CommitPanel } from '@/features/import/components/commit-panel';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';
import { findBatch } from '@/server/services/import/upload';
import { planImport } from '@/server/services/import/plan';

/** STEP4 / STEP5 / STEP6: プレビュー・エラー確認・確定。 */
export default async function ImportPreviewPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'import:run');

  const { batchId } = await params;
  const batch = await findBatch(ctx, batchId);
  if (!batch) notFound();

  // プレビュー・DRY RUN・確定はすべて同じ planImport の結果を使うため、
  // 「プレビューでは成功していたのに確定で失敗する」が起きない。
  const plan = await planImport(ctx, batchId);

  return (
    <>
      <StepNav current={batch.status === 'COMMITTED' ? 6 : 4} />

      <CommitPanel batchId={batchId} summary={plan.summary} />

      <Panel>
        <PanelHeader
          title="データプレビュー"
          description="新規=緑 / 更新=青 / 重複=黄 / エラー=赤 で色分けしています。既定で 50 行表示します。"
        />
        <PreviewTable rows={plan.rows} initialLimit={50} />
      </Panel>
    </>
  );
}
