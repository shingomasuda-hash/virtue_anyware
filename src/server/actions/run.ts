import 'server-only';
import { headers } from 'next/headers';
import type { z } from 'zod';
import { requireAccessContext } from '@/server/auth/session';
import { AuthenticationError, AuthorizationError, requirePermission, type AccessContext } from '@/server/authz/context';
import type { Permission } from '@/server/authz/permissions';
import { actionError, actionOk, type ActionResult } from '@/lib/action-result';
import { DomainError } from '@/lib/errors';

export { DomainError };

export interface ActionRequestInfo {
  ipAddress: string | null;
  userAgent: string | null;
}

/** 監査ログ用にリクエスト情報を取得する。 */
export async function getRequestInfo(): Promise<ActionRequestInfo> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  return {
    ipAddress: forwarded ? (forwarded.split(',')[0]?.trim() ?? null) : h.get('x-real-ip'),
    userAgent: h.get('user-agent'),
  };
}

/**
 * すべての Server Action はこれを通す。
 *
 *   1. 認証（未ログインは即座に拒否）
 *   2. 認可（permission チェック）
 *   3. Zod による入力検証
 *   4. 例外の正規化（スタックトレースをクライアントへ返さない）
 *
 * この順序を守ることで「フロントでしか認可していない」状態を構造的に作れなくする。
 */
export async function runAction<TSchema extends z.ZodType, TResult>(
  options: {
    permission: Permission | readonly Permission[];
    schema: TSchema;
    input: unknown;
  },
  handler: (ctx: AccessContext, input: z.infer<TSchema>, request: ActionRequestInfo) => Promise<TResult>,
): Promise<ActionResult<TResult>> {
  let ctx: AccessContext;
  try {
    ctx = await requireAccessContext();
  } catch {
    return actionError('ログインが必要です。再度ログインしてください。');
  }

  try {
    const permissions = Array.isArray(options.permission)
      ? (options.permission as readonly Permission[])
      : [options.permission as Permission];
    for (const permission of permissions) {
      requirePermission(ctx, permission);
    }

    const parsed = options.schema.safeParse(options.input);
    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || '_';
        (fieldErrors[key] ??= []).push(issue.message);
      }
      return actionError('入力内容に誤りがあります。', fieldErrors);
    }

    const request = await getRequestInfo();
    return actionOk(await handler(ctx, parsed.data as z.infer<TSchema>, request));
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof AuthenticationError) {
      return actionError(error.message);
    }
    if (error instanceof DomainError) {
      return actionError(error.message);
    }
    // 予期しない例外の詳細はサーバーログのみに残す（§31）
    console.error('[action] unexpected error', error);
    return actionError('処理に失敗しました。時間をおいて再度お試しください。');
  }
}
