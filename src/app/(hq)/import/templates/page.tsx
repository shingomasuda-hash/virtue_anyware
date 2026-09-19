import { Panel, PanelHeader } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th, Tr, EmptyRow } from '@/components/ui/table';
import { requireHqContext } from '@/server/auth/guard';
import { requirePermission } from '@/server/authz/context';
import { listTemplates } from '@/server/services/import/templates';
import { formatDateTime, formatInt } from '@/lib/format';
import { TemplateRowActions } from '@/features/import/components/template-actions';

/** 保存済みの CSV マッピングテンプレート（§7）。 */
export default async function ImportTemplatesPage() {
  const { ctx } = await requireHqContext();
  requirePermission(ctx, 'import:run');

  const templates = await listTemplates(ctx);

  return (
    <Panel>
      <PanelHeader
        title={`CSVテンプレート（${templates.length} 件）`}
        description="テンプレートは列マッピング画面から保存できます。「電力会社A CSV」「精算データCSV」のように用途ごとに作成してください。"
      />
      <TableWrap>
        <Table className="min-w-[760px]">
          <thead>
            <tr>
              <Th>テンプレート名</Th>
              <Th>説明</Th>
              <Th align="right">マッピング列数</Th>
              <Th align="right">利用回数</Th>
              <Th>更新日時</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <EmptyRow colSpan={6} message="テンプレートはまだありません。列マッピング画面から保存できます。" />
            ) : (
              templates.map((template) => {
                const mappings = (template.columnMappings ?? {}) as Record<string, string | null>;
                const mappedCount = Object.values(mappings).filter(Boolean).length;
                return (
                  <Tr key={template.id}>
                    <Td className="font-medium">{template.name}</Td>
                    <Td className="text-[var(--color-ink-muted)]">{template.description ?? '—'}</Td>
                    <Td numeric>{formatInt(mappedCount)}</Td>
                    <Td numeric>{formatInt(template._count.batches)}</Td>
                    <Td className="num">{formatDateTime(template.updatedAt)}</Td>
                    <Td align="right"><TemplateRowActions templateId={template.id} /></Td>
                  </Tr>
                );
              })
            )}
          </tbody>
        </Table>
      </TableWrap>
    </Panel>
  );
}
