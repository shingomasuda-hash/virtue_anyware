import { NextResponse } from 'next/server';
import { resolveBaseUrl } from '@/server/auth/base-url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 稼働診断エンドポイント。
 *
 *   GET /api/health
 *
 * デプロイ先（Vercel など）でのみ再現する問題を切り分けるために使う。
 * ログを見に行かなくても、ブラウザで開けば「何が足りないか」が分かる。
 *
 * **秘密情報は一切返さない。** 接続文字列・鍵・個人情報は出力せず、
 * 設定の有無とホスト名を伏せたエラー概要だけを返す。
 */

type CheckStatus = 'ok' | 'warn' | 'error';

interface Check {
  name: string;
  status: CheckStatus;
  detail: string;
  hint?: string;
}

/**
 * エラーメッセージから接続情報らしき部分を取り除く。
 * Prisma のエラーは先頭に空行や装飾が入るため、最初の「意味のある行」を拾う。
 */
function redact(message: string): string {
  const meaningful = message
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^[-=~`\s]+$/.test(line));

  // Prisma は原因行（例: relation "users" does not exist）を後方に置くことがある
  const causeLine = meaningful.find((line) => /does not exist|Unknown|failed|error/i.test(line));
  const picked = causeLine ?? meaningful[0] ?? message;

  return picked
    .replace(/postgres(ql)?:\/\/[^\s"']+/gi, 'postgresql://<redacted>')
    .replace(/\b[\w.-]+@[\w.-]+\.[\w.-]+\b/g, '<redacted>')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, '<redacted>')
    .slice(0, 300);
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    const raw = [error.message, (error.cause as Error | undefined)?.message].filter(Boolean).join('\n');
    const text = redact(raw);
    return text.length > 0 ? text : error.name;
  }
  return redact(String(error));
}

export async function GET() {
  const checks: Check[] = [];

  // ── 環境変数 ──
  const databaseUrl = process.env.DATABASE_URL;
  checks.push({
    name: 'DATABASE_URL',
    status: databaseUrl ? 'ok' : 'error',
    detail: databaseUrl ? '設定済み' : '未設定',
    hint: databaseUrl
      ? undefined
      : 'Vercel の Project Settings → Environment Variables に設定し、再デプロイしてください。',
  });

  if (databaseUrl) {
    const pooled = /-pooler|pgbouncer=true|\bpool\b/i.test(databaseUrl);
    checks.push({
      name: 'DATABASE_URL のプーラー',
      status: pooled ? 'ok' : 'warn',
      detail: pooled ? 'プーラー経由' : 'プーラー指定が見当たりません',
      hint: pooled ? undefined : 'サーバーレスでは接続上限に達しやすいため、Neon なら -pooler 付きの URL を使ってください。',
    });
    const ssl = /sslmode=(require|verify-full|verify-ca)/.test(databaseUrl);
    checks.push({
      name: 'DATABASE_URL の SSL',
      status: ssl ? 'ok' : 'warn',
      detail: ssl ? 'sslmode 指定あり' : 'sslmode の指定がありません',
      hint: ssl ? undefined : '?sslmode=require を付与してください。',
    });
  }

  const secret = process.env.BETTER_AUTH_SECRET ?? '';
  checks.push({
    name: 'BETTER_AUTH_SECRET',
    status: secret.length >= 32 ? 'ok' : 'error',
    detail: secret.length === 0 ? '未設定' : `${secret.length} 文字`,
    hint: secret.length >= 32 ? undefined : '32 文字以上の値を設定してください（openssl rand -base64 32）。',
  });

  const baseUrl = resolveBaseUrl();
  checks.push({
    name: '公開 URL',
    status: baseUrl.startsWith('https://') ? 'ok' : 'warn',
    // 公開 URL は秘密ではないが、設定状況が分かれば十分なので出し過ぎない
    detail: baseUrl,
    hint: baseUrl.startsWith('https://')
      ? undefined
      : 'BETTER_AUTH_URL に公開 URL を設定してください。未設定だとログイン後のリダイレクトが壊れます。',
  });

  // ── Prisma の初期化と DB 接続 ──
  let canQuery = false;
  if (databaseUrl) {
    try {
      const { prisma } = await import('@/server/db');
      await prisma.$queryRaw`SELECT 1`;
      canQuery = true;
      checks.push({ name: 'データベース接続', status: 'ok', detail: 'OK' });
    } catch (error) {
      checks.push({
        name: 'データベース接続',
        status: 'error',
        detail: messageOf(error),
        hint: 'DATABASE_URL の値、ネットワーク到達性、SSL 設定を確認してください。',
      });
    }
  }

  // ── マイグレーションと初期データ ──
  if (canQuery) {
    try {
      const { prisma } = await import('@/server/db');
      const userCount = await prisma.user.count();
      checks.push({ name: 'マイグレーション適用', status: 'ok', detail: 'テーブルを確認できました' });

      checks.push({
        name: '管理者アカウント',
        // 公開エンドポイントのため、正常時は件数を出さない
        status: userCount > 0 ? 'ok' : 'error',
        detail: userCount > 0 ? '登録済み' : 'ユーザーが 1 件もありません',
        hint:
          userCount > 0
            ? undefined
            : 'ADMIN_EMAIL=... npm run db:bootstrap を本番 DB に対して実行してください。',
      });

      const [orgCount, statusCount] = await Promise.all([
        prisma.organization.count(),
        prisma.contractStatus.count(),
      ]);
      const mastersReady = orgCount > 0 && statusCount > 0;
      checks.push({
        name: 'マスタデータ',
        status: mastersReady ? 'ok' : 'error',
        detail: mastersReady
          ? '登録済み'
          : `未投入（組織 ${orgCount} 件 / 契約ステータス ${statusCount} 件）`,
        hint: mastersReady ? undefined : 'npm run db:bootstrap を実行してください。',
      });
    } catch (error) {
      checks.push({
        name: 'マイグレーション適用',
        status: 'error',
        detail: messageOf(error),
        hint: 'npx prisma migrate deploy を本番 DB に対して実行してください。',
      });
    }
  }

  const hasError = checks.some((c) => c.status === 'error');
  return NextResponse.json(
    {
      ok: !hasError,
      checkedAt: new Date().toISOString(),
      summary: hasError
        ? '設定または初期化が完了していません。checks の error を解消してください。'
        : 'すべてのチェックを通過しました。',
      checks,
    },
    {
      status: hasError ? 503 : 200,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
