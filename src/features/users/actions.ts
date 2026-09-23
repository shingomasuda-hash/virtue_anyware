'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { APIError } from 'better-auth/api';
import { runAction, getRequestInfo } from '@/server/actions/run';
import { auth } from '@/server/auth/auth';
import { requireAccessContext } from '@/server/auth/session';
import { createUser, recordPasswordChange, resetUserPassword, updateUser } from '@/server/services/users';
import { actionError, actionOk, type ActionResult } from '@/lib/action-result';
import { formDataToObject } from '@/lib/zod-helpers';
import { changePasswordSchema, userCreateSchema, userPasswordResetSchema, userUpdateSchema } from './schema';

export async function createUserAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'user:manage', schema: userCreateSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const user = await createUser(
        ctx,
        {
          email: input.email,
          name: input.name,
          role: input.role,
          agencyId: input.agencyId,
          phone: input.phone,
          isActive: input.isActive,
          password: input.password,
        },
        request,
      );
      revalidatePath('/users');
      return { id: user.id };
    },
  );
}

export async function updateUserAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'user:manage', schema: userUpdateSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const { id, ...rest } = input;
      const result = await updateUser(ctx, id, rest, request);
      if (!result) throw new Error('NOT_FOUND');
      revalidatePath('/users');
      revalidatePath(`/users/${id}/edit`);
      return { id };
    },
  );
}

/** 管理者によるパスワード再設定。対象ユーザーの全セッションを失効させる。 */
export async function resetUserPasswordAction(_prev: unknown, formData: FormData) {
  return runAction(
    { permission: 'user:manage', schema: userPasswordResetSchema, input: formDataToObject(formData) },
    async (ctx, input, request) => {
      const target = await resetUserPassword(ctx, input.id, input.password, request);
      if (!target) throw new Error('NOT_FOUND');
      revalidatePath('/users');
      return { id: input.id };
    },
  );
}

/**
 * 本人によるパスワード変更。
 *
 * これは権限ではなく「ログイン済みの本人であること」だけを条件にするため
 * runAction（permission 必須）ではなく個別に組み立てる。
 * 現在のパスワードの検証は Better Auth 側で行い、ハッシュ比較を自前で書かない。
 */
export async function changePasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ changed: true }>> {
  let ctx;
  try {
    ctx = await requireAccessContext();
  } catch {
    return actionError('ログインが必要です。再度ログインしてください。');
  }

  const parsed = changePasswordSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_';
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return actionError('入力内容に誤りがあります。', fieldErrors);
  }

  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        // 変更前のパスワードで確立された他端末のセッションを残さない
        revokeOtherSessions: true,
      },
    });
  } catch (error) {
    if (error instanceof APIError) {
      return actionError('現在のパスワードが正しくありません。');
    }
    console.error('[action] changePassword failed', error);
    return actionError('パスワードを変更できませんでした。時間をおいて再度お試しください。');
  }

  await recordPasswordChange(ctx, await getRequestInfo());
  return actionOk({ changed: true as const });
}
