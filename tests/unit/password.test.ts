import { describe, expect, it } from 'vitest';
import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  describePasswordPolicy,
  isValidPassword,
  validatePassword,
} from '@/lib/password';

describe('パスワードポリシー（docs/12_SECURITY.md）', () => {
  it('12 文字未満は拒否する', () => {
    expect(isValidPassword('Ab1!xyz')).toBe(false);
    expect(validatePassword('Ab1!xyz').some((i) => i.message.includes(`${MIN_PASSWORD_LENGTH} 文字以上`))).toBe(true);
  });

  it('文字種が 2 種類以下なら拒否する', () => {
    // 小文字 + 数字のみ（16 文字あっても不合格）
    expect(isValidPassword('abcdefgh12345678')).toBe(false);
  });

  it('3 種類以上かつ 12 文字以上なら合格する', () => {
    expect(isValidPassword('Str0ngPassword')).toBe(true);
    expect(isValidPassword('virtue-Sales-OS-2026')).toBe(true);
  });

  it('よくあるパスワードは長さを満たしていても拒否する', () => {
    // 記号や大文字で水増ししても、記号を除いた形が辞書に一致すれば拒否
    expect(isValidPassword('Password-123!')).toBe(false);
    expect(isValidPassword('Administrator!')).toBe(false);
  });

  it('同一文字の繰り返しは拒否する', () => {
    expect(isValidPassword('aaaaaaaaaaaaaaaa')).toBe(false);
  });

  it('上限を超える長さは拒否する', () => {
    const tooLong = `Aa1!${'x'.repeat(MAX_PASSWORD_LENGTH)}`;
    expect(isValidPassword(tooLong)).toBe(false);
  });

  it('ポリシー文言に必要な条件が含まれる', () => {
    expect(describePasswordPolicy()).toContain(`${MIN_PASSWORD_LENGTH} 文字以上`);
  });
});

describe('ユーザーフォームの入力検証', () => {
  it('確認用パスワードが一致しないと登録できない', async () => {
    const { userCreateSchema } = await import('@/features/users/schema');
    const result = userCreateSchema.safeParse({
      email: 'new@example.jp',
      name: '新規',
      role: 'HQ_STAFF',
      isActive: 'true',
      password: 'Str0ng!Passw0rd#2026',
      passwordConfirm: 'Str0ng!Passw0rd#2027',
    });
    expect(result.success).toBe(false);
  });

  it('状態は true / false のみ受け付ける（未送信で暗黙に無効化されない）', async () => {
    const { userUpdateSchema } = await import('@/features/users/schema');
    const base = { id: 'u1', email: 'a@example.jp', name: '氏名', role: 'HQ_STAFF' as const };
    expect(userUpdateSchema.safeParse({ ...base, isActive: 'true' }).success).toBe(true);
    expect(userUpdateSchema.safeParse({ ...base }).success).toBe(false);
    expect(userUpdateSchema.safeParse({ ...base, isActive: 'on' }).success).toBe(false);
  });

  it('現在のパスワードと同じ新パスワードは拒否する', async () => {
    const { changePasswordSchema } = await import('@/features/users/schema');
    const same = 'Str0ng!Passw0rd#2026';
    expect(
      changePasswordSchema.safeParse({ currentPassword: same, newPassword: same, newPasswordConfirm: same }).success,
    ).toBe(false);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: 'Old!Passw0rd#2025',
        newPassword: same,
        newPasswordConfirm: same,
      }).success,
    ).toBe(true);
  });
});
