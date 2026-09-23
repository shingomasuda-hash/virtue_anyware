import { z } from 'zod';
import { optionalId, optionalText } from '@/lib/zod-helpers';
import { MAX_PASSWORD_LENGTH, validatePassword } from '@/lib/password';

/**
 * パスワード欄。強度判定は `@/lib/password` に一本化し、
 * 画面・Server Action・初期化スクリプトで基準がずれないようにする。
 */
const passwordField = z
  .string()
  .max(MAX_PASSWORD_LENGTH)
  .superRefine((value, ctx) => {
    for (const issue of validatePassword(value)) {
      ctx.addIssue({ code: 'custom', message: issue.message });
    }
  });

export const userRoleField = z.enum(['SUPER_ADMIN', 'HQ_ADMIN', 'HQ_STAFF', 'AGENCY_ADMIN', 'AGENCY_STAFF']);

/** `<select>` の "true" / "false" を真偽値へ。チェックボックスは未チェック時に送信されず、意図と値がずれるため使わない。 */
const booleanField = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true');

const userBaseSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'メールアドレスは必須です。')
    .max(160)
    .email('メールアドレスの形式が正しくありません。'),
  name: z.string().trim().min(1, '氏名は必須です。').max(80),
  role: userRoleField,
  agencyId: optionalId(),
  phone: optionalText(32),
  isActive: booleanField,
});

export const userCreateSchema = userBaseSchema
  .extend({
    password: passwordField,
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: '確認用パスワードが一致しません。',
    path: ['passwordConfirm'],
  });

export const userUpdateSchema = userBaseSchema.extend({ id: z.string().min(1) });

export const userPasswordResetSchema = z
  .object({
    id: z.string().min(1),
    password: passwordField,
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: '確認用パスワードが一致しません。',
    path: ['passwordConfirm'],
  });

/** 本人によるパスワード変更。現在のパスワードの確認を必須にする。 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '現在のパスワードを入力してください。'),
    newPassword: passwordField,
    newPasswordConfirm: z.string(),
  })
  .refine((v) => v.newPassword === v.newPasswordConfirm, {
    message: '確認用パスワードが一致しません。',
    path: ['newPasswordConfirm'],
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: '現在のパスワードとは異なる値にしてください。',
    path: ['newPassword'],
  });
