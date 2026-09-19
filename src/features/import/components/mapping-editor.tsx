'use client';

import { useActionState, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Table, TableWrap, Td, Th, Tr } from '@/components/ui/table';
import { Field, Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormError, SubmitButton } from '@/components/data/form-shell';
import type { ActionResult } from '@/lib/action-result';
import { loadTemplateAction, saveMappingAction, saveTemplateAction } from '../actions';

export interface FieldChoice {
  key: string;
  label: string;
  target: 'customer' | 'contract';
  required: boolean;
}

export interface MappingEditorProps {
  batchId: string;
  headers: string[];
  sampleRows: Array<Record<string, string>>;
  initialMappings: Record<string, string | null>;
  fields: FieldChoice[];
  templates: Array<{ id: string; name: string }>;
  agencies: Array<{ id: string; name: string }>;
  statuses: Array<{ code: string; label: string }>;
  initialOptions: {
    unknownAgency: 'error' | 'warning';
    defaultStatusCode: string | null;
    fixedAgencyId: string | null;
    createOnReview: boolean;
  };
}

type MappingState = ActionResult<{ batchId: string }> | null;
type TemplateState = ActionResult<{ id: string; name: string }> | null;

/**
 * STEP3: 列マッピング。
 *
 * CSV の列名がどうであれ、システム項目へ自由に紐付けられる。
 * 特定の CSV フォーマットに固定しないための中核画面。
 */
export function MappingEditor({
  batchId,
  headers,
  sampleRows,
  initialMappings,
  fields,
  templates,
  agencies,
  statuses,
  initialOptions,
}: MappingEditorProps) {
  const router = useRouter();
  const [mappings, setMappings] = useState<Record<string, string | null>>(initialMappings);
  const [options, setOptions] = useState(initialOptions);
  const [templateId, setTemplateId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const [state, formAction] = useActionState<MappingState, FormData>(async (prev, formData) => {
    const result = (await saveMappingAction(prev, formData)) as MappingState;
    if (result?.ok) {
      router.push(`/import/${batchId}/preview`);
      router.refresh();
    }
    return result;
  }, null);

  const [templateState, templateFormAction] = useActionState<TemplateState, FormData>(
    async (prev, formData) => (await saveTemplateAction(prev, formData)) as TemplateState,
    null,
  );

  /** 同じシステム項目に複数の CSV 列が割り当てられていないか */
  const conflicts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const value of Object.values(mappings)) {
      if (!value) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([key]) => key));
  }, [mappings]);

  const mappedRequired = useMemo(() => {
    const mapped = new Set(Object.values(mappings).filter(Boolean) as string[]);
    return fields.filter((f) => f.required).every((f) => mapped.has(f.key));
  }, [mappings, fields]);

  async function applyTemplate(id: string) {
    setTemplateId(id);
    if (!id) return;
    setLoadingTemplate(true);
    const formData = new FormData();
    formData.append('id', id);
    const result = await loadTemplateAction(null, formData);
    if (result.ok) {
      // テンプレートのマッピングのうち、今回の CSV に存在する列だけを反映する
      const next: Record<string, string | null> = {};
      for (const header of headers) next[header] = result.data.columnMappings[header] ?? null;
      setMappings(next);
      setOptions({
        unknownAgency: result.data.options.unknownAgency,
        defaultStatusCode: result.data.options.defaultStatusCode,
        fixedAgencyId: result.data.options.fixedAgencyId,
        createOnReview: result.data.options.createOnReview,
      });
    }
    setLoadingTemplate(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <PanelHeader
          title="取込テンプレート"
          description="一度設定した列マッピングを保存し、次回から自動で適用できます。"
        />
        <PanelBody className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="テンプレートを読み込む">
              <Select value={templateId} onChange={(e) => void applyTemplate(e.target.value)} disabled={loadingTemplate}>
                <option value="">選択してください</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <form action={templateFormAction} className="flex flex-wrap items-end gap-2 border-t border-[var(--color-border)] pt-3">
            <input type="hidden" name="batchId" value={batchId} />
            <div className="w-56">
              <Field label="この設定をテンプレートとして保存" hint="例: 電力会社A 開通結果CSV">
                <Input name="name" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="テンプレート名" />
              </Field>
            </div>
            <SubmitButton>保存</SubmitButton>
            {templateState?.ok ? (
              <span className="text-[12px] text-[var(--color-positive)]">
                「{templateState.data.name}」を保存しました（現在の設定を保存したい場合は先に下の「保存して次へ」を実行してください）
              </span>
            ) : null}
            <FormError state={templateState} />
          </form>
        </PanelBody>
      </Panel>

      <form action={formAction} className="flex flex-col gap-5">
        <input type="hidden" name="batchId" value={batchId} />
        <input type="hidden" name="mappings" value={JSON.stringify(mappings)} />
        <input type="hidden" name="templateId" value={templateId} />

        <Panel>
          <PanelHeader
            title={`列マッピング（${headers.length} 列）`}
            description="CSV の列名がどうであれ、システム項目へ自由に紐付けられます。不要な列は「取り込まない」のままにしてください。"
          />
          <TableWrap>
            <Table className="min-w-[860px]">
              <thead>
                <tr>
                  <Th>CSV 列名</Th>
                  <Th>サンプル値</Th>
                  <Th>システム項目</Th>
                  <Th>区分</Th>
                </tr>
              </thead>
              <tbody>
                {headers.map((header) => {
                  const mapped = mappings[header] ?? '';
                  const field = fields.find((f) => f.key === mapped);
                  const conflict = mapped !== '' && conflicts.has(mapped);
                  return (
                    <Tr key={header}>
                      <Td className="font-medium">{header}</Td>
                      <Td className="max-w-[220px] truncate text-[12px] text-[var(--color-ink-subtle)]">
                        {sampleRows.slice(0, 2).map((row) => row[header]).filter(Boolean).join(' / ') || '—'}
                      </Td>
                      <Td>
                        <Select
                          value={mapped}
                          onChange={(e) =>
                            setMappings((prev) => ({ ...prev, [header]: e.target.value || null }))
                          }
                          className={conflict ? 'border-[var(--color-negative)]' : undefined}
                        >
                          <option value="">取り込まない</option>
                          {fields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                              {f.required ? ' *' : ''}
                            </option>
                          ))}
                        </Select>
                        {conflict ? (
                          <p className="mt-1 text-[11px] text-[var(--color-negative)]">
                            同じ項目が複数の列に割り当てられています。
                          </p>
                        ) : null}
                      </Td>
                      <Td>
                        {field ? (
                          <Badge tone={field.target === 'customer' ? 'brand' : 'neutral'}>
                            {field.target === 'customer' ? '顧客' : '契約'}
                          </Badge>
                        ) : (
                          <span className="text-[var(--color-ink-subtle)]">—</span>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </Panel>

        <Panel>
          <PanelHeader title="取込オプション" description="CSV から解決できない値の扱いを決めます。" />
          <PanelBody className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="代理店が特定できない場合">
                <Select
                  name="unknownAgency"
                  value={options.unknownAgency}
                  onChange={(e) => setOptions((p) => ({ ...p, unknownAgency: e.target.value as 'error' | 'warning' }))}
                >
                  <option value="error">エラーにして取り込まない</option>
                  <option value="warning">警告を出して取り込む</option>
                </Select>
              </Field>
              <Field label="取込先の代理店を固定" hint="CSV に代理店列が無い場合に指定">
                <Select
                  name="fixedAgencyId"
                  value={options.fixedAgencyId ?? ''}
                  onChange={(e) => setOptions((p) => ({ ...p, fixedAgencyId: e.target.value || null }))}
                >
                  <option value="">固定しない（CSV の値を使う）</option>
                  {agencies.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="既定の契約ステータス" hint="CSV から解決できない場合に使用">
                <Select
                  name="defaultStatusCode"
                  value={options.defaultStatusCode ?? ''}
                  onChange={(e) => setOptions((p) => ({ ...p, defaultStatusCode: e.target.value || null }))}
                >
                  <option value="">指定しない</option>
                  {statuses.map((s) => (
                    <option key={s.code} value={s.code}>{s.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="重複候補の扱い">
                <label className="flex h-8 items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    name="createOnReview"
                    checked={options.createOnReview}
                    onChange={(e) => setOptions((p) => ({ ...p, createOnReview: e.target.checked }))}
                  />
                  重複候補も新規として取り込む
                </label>
              </Field>
            </div>
            <p className="text-[11px] text-[var(--color-ink-subtle)]">
              既定では、完全一致しない重複候補は自動登録せず「要確認」として保留します。
            </p>
          </PanelBody>
        </Panel>

        <FormError state={state} />

        <div className="flex items-center gap-2">
          <SubmitButton>保存してプレビューへ</SubmitButton>
          <Button type="button" variant="ghost" onClick={() => router.push('/import')}>
            最初からやり直す
          </Button>
          {!mappedRequired ? (
            <span className="text-[12px] text-[var(--color-warning)]">
              必須項目（氏名）が未マッピングです。このまま進むと全行がエラーになります。
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
