import { randomBytes } from 'node:crypto';

/** 開発既定のデモパスワード。本番では絶対に使わせない。 */
export const DEFAULT_DEMO_PASSWORD = 'Virtue#2026';

/** 開発既定の秘密鍵に含まれる目印。本番で検出したら起動を止める。 */
export const DEV_SECRET_MARKER = 'dev-only-secret';

export const DEMO_EMAIL_DOMAINS = ['virtue.example.jp', 'example.jp'] as const;

/**
 * デモデータ投入の可否を判定する。
 *
 * 本番環境（NODE_ENV=production）や、本番らしい DATABASE_URL に対しては
 * 既定で投入を拒否する。どうしても必要な場合のみ ALLOW_DEMO_SEED=true を明示させる。
 */
export function assertSeedAllowed(): void {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const override = process.env.ALLOW_DEMO_SEED === 'true';

  const reasons: string[] = [];
  if (nodeEnv === 'production') reasons.push('NODE_ENV=production です');
  if (/(prod|production)/i.test(databaseUrl)) reasons.push('DATABASE_URL が本番らしい名前を含んでいます');

  if (reasons.length > 0 && !override) {
    throw new Error(
      [
        '本番環境と判定されたため、デモデータの投入を中止しました。',
        ...reasons.map((r) => `  - ${r}`),
        '',
        'デモデータには既知のパスワードを持つアカウントが含まれます。本番DBへは投入しないでください。',
        '検証目的でどうしても実行する場合のみ ALLOW_DEMO_SEED=true を指定してください。',
      ].join('\n'),
    );
  }

  if (reasons.length > 0 && override) {
    console.warn('⚠️  本番らしい環境に ALLOW_DEMO_SEED=true でデモデータを投入します。投入後は必ず全アカウントを再作成してください。');
  }
}

/**
 * デモユーザーのパスワードを決める。
 *
 * - `SEED_DEMO_PASSWORD` が指定されていればそれを使う
 * - 未指定かつ開発/テスト環境なら、README に記載された既定値を使う（開発の利便性）
 * - 未指定かつそれ以外なら、**ランダム生成**してコンソールへ出す
 *   （既知パスワードのアカウントが意図せず残らないようにする）
 */
export function resolveDemoPassword(): { password: string; generated: boolean } {
  const fromEnv = process.env.SEED_DEMO_PASSWORD;
  if (fromEnv) {
    if (fromEnv.length < 8) throw new Error('SEED_DEMO_PASSWORD は 8 文字以上にしてください。');
    return { password: fromEnv, generated: false };
  }

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'development' || nodeEnv === 'test') {
    return { password: DEFAULT_DEMO_PASSWORD, generated: false };
  }

  return { password: `${randomBytes(12).toString('base64url')}#Aa1`, generated: true };
}
