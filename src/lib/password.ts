/**
 * パスワードポリシー（docs/12_SECURITY.md）。
 *
 * 12 文字以上・英大文字/小文字/数字/記号のうち 3 種類以上。
 * よくあるパスワードは拒否する。
 *
 * 画面・Server Action・初期化スクリプトのすべてがここを参照し、
 * 場所によって強度が違う状態を作らない。
 */

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;
export const MIN_CHARACTER_CLASSES = 3;

/** 辞書攻撃で最初に試されるものだけを最小限で拒否する。 */
const COMMON_PASSWORDS = new Set([
  'password', 'password123', 'passw0rd', '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'letmein', 'welcome', 'admin', 'admin123', 'administrator',
  'iloveyou', 'abc123', 'monkey', 'dragon', 'sunshine', 'princess', 'football',
  'virtue', 'virtue123', 'anyware', 'test1234', 'changeme',
]);

export interface PasswordIssue {
  message: string;
}

/** 満たしていない条件を列挙する。空配列なら合格。 */
export function validatePassword(password: string): PasswordIssue[] {
  const issues: PasswordIssue[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    issues.push({ message: `${MIN_PASSWORD_LENGTH} 文字以上にしてください。` });
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    issues.push({ message: `${MAX_PASSWORD_LENGTH} 文字以内にしてください。` });
  }

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < MIN_CHARACTER_CLASSES) {
    issues.push({
      message: `英大文字・英小文字・数字・記号のうち ${MIN_CHARACTER_CLASSES} 種類以上を含めてください。`,
    });
  }

  const normalized = password.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (COMMON_PASSWORDS.has(normalized)) {
    issues.push({ message: '推測されやすいパスワードです。別の値にしてください。' });
  }

  if (/^(.)\1+$/.test(password)) {
    issues.push({ message: '同じ文字の繰り返しは使用できません。' });
  }

  return issues;
}

export function isValidPassword(password: string): boolean {
  return validatePassword(password).length === 0;
}

/** Zod などへ渡すための単一メッセージ。 */
export function describePasswordPolicy(): string {
  return `${MIN_PASSWORD_LENGTH} 文字以上で、英大文字・英小文字・数字・記号のうち ${MIN_CHARACTER_CLASSES} 種類以上を含めてください。`;
}
