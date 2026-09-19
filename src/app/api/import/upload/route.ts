import { NextResponse, type NextRequest } from 'next/server';
import { getAccessContext } from '@/server/auth/session';
import { can } from '@/server/authz/context';
import { uploadCsv, MAX_UPLOAD_BYTES } from '@/server/services/import/upload';
import { DomainError } from '@/lib/errors';
import type { CsvEncoding } from '@/server/services/csv/encoding';

export const runtime = 'nodejs';

/** IP ごとの簡易レート制限（§31）。大きなファイルの連投を防ぐ。 */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

/**
 * STEP1: CSV アップロード。
 *
 * Server Action ではなく Route Handler にしているのは、
 * Server Action のボディサイズ上限に縛られず 20MB まで受け取るため。
 * 認証・認可はここでも必ず行う（middleware に依存しない）。
 */
export async function POST(request: NextRequest) {
  const ctx = await getAccessContext();
  if (!ctx) {
    return NextResponse.json({ ok: false, error: 'ログインが必要です。' }, { status: 401 });
  }
  // 代理店ユーザーは CSV 取込を行えない（docs/04_RBAC.md）
  if (!can(ctx, 'import:run')) {
    return NextResponse.json({ ok: false, error: 'CSV 取込の権限がありません。' }, { status: 403 });
  }
  if (rateLimited(ctx.userId)) {
    return NextResponse.json({ ok: false, error: 'アップロードが多すぎます。しばらく待って再試行してください。' }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: 'ファイルを読み取れませんでした。' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'ファイルが指定されていません。' }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ ok: false, error: 'ファイルサイズが上限を超えています。' }, { status: 413 });
  }

  const encodingParam = formData.get('encoding');
  const encoding: CsvEncoding | 'auto' =
    encodingParam === 'UTF-8' || encodingParam === 'SJIS' || encodingParam === 'UTF-8-BOM' ? encodingParam : 'auto';

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const result = await uploadCsv(ctx, { name: file.name, size: file.size, buffer }, encoding);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    if (error instanceof DomainError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    console.error('[import/upload] failed', error);
    return NextResponse.json({ ok: false, error: '取り込みに失敗しました。' }, { status: 500 });
  }
}
