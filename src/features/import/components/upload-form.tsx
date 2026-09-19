'use client';

import { useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Panel, PanelBody, PanelHeader } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/input';
import { cn } from '@/lib/cn';

interface UploadResponse {
  ok: boolean;
  error?: string;
  data?: { batchId: string; duplicateOfBatch: { fileName: string; createdAt: string } | null };
}

/** STEP1: ドラッグ&ドロップでの CSV アップロード。 */
export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [encoding, setEncoding] = useState('auto');
  const [fileName, setFileName] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('encoding', encoding);

    try {
      const response = await fetch('/api/import/upload', { method: 'POST', body: formData });
      const json = (await response.json()) as UploadResponse;
      if (!json.ok || !json.data) {
        setError(json.error ?? 'アップロードに失敗しました。');
        setBusy(false);
        return;
      }
      router.push(`/import/${json.data.batchId}`);
      router.refresh();
    } catch {
      setError('アップロードに失敗しました。通信環境を確認してください。');
      setBusy(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void upload(file);
  }

  return (
    <Panel>
      <PanelHeader
        title="CSV をアップロード"
        description="UTF-8 / Shift-JIS(CP932) に対応しています。この時点では顧客・契約は登録されません。"
      />
      <PanelBody className="flex flex-col gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] px-6 py-12 text-center',
            dragging && 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]',
          )}
        >
          <p className="text-[14px] font-medium">CSV ファイルをここにドラッグ&ドロップ</p>
          <p className="text-[12px] text-[var(--color-ink-subtle)]">
            または
            <button
              type="button"
              className="mx-1 text-[var(--color-brand)] underline"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              ファイルを選択
            </button>
            （最大 20MB / 50,000 行）
          </p>
          {fileName ? <p className="text-[12px] text-[var(--color-ink-muted)]">{fileName}</p> : null}
          {busy ? <p className="text-[12px] text-[var(--color-brand)]">解析中…</p> : null}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="文字コード" hint="通常は自動判定のままで構いません">
            <Select value={encoding} onChange={(e) => setEncoding(e.target.value)} disabled={busy}>
              <option value="auto">自動判定</option>
              <option value="UTF-8">UTF-8</option>
              <option value="UTF-8-BOM">UTF-8 (BOM付き)</option>
              <option value="SJIS">Shift-JIS (CP932)</option>
            </Select>
          </Field>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-[var(--radius-sm)] border border-[#fecdca] bg-[var(--color-negative-soft)] px-3 py-2 text-[12px] text-[var(--color-negative)]"
          >
            {error}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/import/history')}>
            取込履歴を見る
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push('/import/templates')}>
            CSVテンプレートを管理
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}
