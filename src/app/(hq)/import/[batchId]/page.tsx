import { notFound } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { StepNav } from '@/features/import/components/step-nav';
import { MappingEditor } from '@/features/import/components/mapping-editor';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';
import { orgScope } from '@/server/authz/scope';
import { prisma } from '@/server/db';
import { findBatch } from '@/server/services/import/upload';
import { listTemplates } from '@/server/services/import/templates';
import { parseColumnMappings, parseImportOptions } from '@/server/services/import/types';
import { FIELD_CATALOG } from '@/server/services/csv/field-catalog';
import { formatInt } from '@/lib/format';

/** STEP2 / STEP3: 解析結果の確認と列マッピング。 */
export default async function ImportMappingPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'import:run');

  const { batchId } = await params;
  const batch = await findBatch(ctx, batchId);
  if (!batch) notFound();

  const scope = orgScope(ctx);
  const orgWhere = scope.organizationId ? { organizationId: scope.organizationId } : {};

  const [sampleRows, templates, agencies, statuses] = await Promise.all([
    prisma.importRow.findMany({ where: { batchId }, orderBy: { rowNumber: 'asc' }, take: 5 }),
    listTemplates(ctx),
    prisma.agency.findMany({ where: { ...orgWhere, deletedAt: null }, orderBy: { code: 'asc' } }),
    prisma.contractStatus.findMany({ where: { ...orgWhere, isActive: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  const mappings = parseColumnMappings(batch.columnMappings);
  const headers = Object.keys(mappings);
  const samples = sampleRows.map((r) => (r.raw ?? {}) as Record<string, string>);

  return (
    <>
      <StepNav current={3} />

      <Panel>
        <PanelHeader title="CSV 解析結果" description="この時点では顧客・契約は登録されていません。" />
        <PanelBody>
          <dl className="grid gap-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
            <Item label="ファイル名" value={batch.fileName} />
            <Item label="文字コード" value={batch.encoding} />
            <Item label="データ行数" value={`${formatInt(batch.totalRows)} 行`} />
            <Item label="列数" value={`${headers.length} 列`} />
          </dl>
        </PanelBody>
      </Panel>

      <MappingEditor
        batchId={batch.id}
        headers={headers}
        sampleRows={samples}
        initialMappings={mappings}
        initialOptions={parseImportOptions(batch.options)}
        fields={FIELD_CATALOG.map((f) => ({
          key: f.key,
          label: f.label,
          target: f.target,
          required: f.required ?? false,
        }))}
        templates={templates.map((t) => ({ id: t.id, name: t.name }))}
        agencies={agencies.map((a) => ({ id: a.id, name: a.name }))}
        statuses={statuses.map((s) => ({ code: s.code, label: s.label }))}
      />
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-[var(--color-ink-subtle)]">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}
