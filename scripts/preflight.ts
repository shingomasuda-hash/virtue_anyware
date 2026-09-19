import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { DEFAULT_DEMO_PASSWORD, DEMO_EMAIL_DOMAINS, DEV_SECRET_MARKER } from '../prisma/seed/guard.js';

/**
 * 本番投入前チェック。
 *
 *   npm run preflight
 *
 * 「開発用の資格情報が本番へ持ち込まれていないか」を機械的に検査する。
 * 1 件でも重大な問題があれば非ゼロ終了する（CI / デプロイ前フックで使う想定）。
 */

interface Check {
  name: string;
  level: 'error' | 'warn';
  ok: boolean;
  detail: string;
}

const checks: Check[] = [];

function add(name: string, level: Check['level'], ok: boolean, detail: string) {
  checks.push({ name, level, ok, detail });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  const secret = process.env.BETTER_AUTH_SECRET ?? '';
  const authUrl = process.env.BETTER_AUTH_URL ?? '';

  // ── 環境変数 ──
  add('DATABASE_URL が設定されている', 'error', databaseUrl.length > 0, databaseUrl ? '設定済み' : '未設定');
  add(
    'BETTER_AUTH_SECRET が 32 バイト以上',
    'error',
    secret.length >= 32,
    secret ? `${secret.length} 文字` : '未設定',
  );
  add(
    'BETTER_AUTH_SECRET が開発既定値でない',
    'error',
    secret.length > 0 && !secret.includes(DEV_SECRET_MARKER),
    secret.includes(DEV_SECRET_MARKER) ? '開発用の既定値が使われています' : 'OK',
  );
  add(
    'BETTER_AUTH_URL が https',
    'warn',
    authUrl.startsWith('https://'),
    authUrl || '未設定',
  );
  add(
    'DATABASE_URL が SSL を要求している',
    'warn',
    /sslmode=(require|verify-full|verify-ca)/.test(databaseUrl),
    /sslmode=/.test(databaseUrl) ? 'sslmode 指定あり' : 'sslmode の指定がありません',
  );

  if (!databaseUrl) {
    report();
    return;
  }

  // ── DB 上のアカウント ──
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  try {
    // 接続できない場合はスタックトレースではなく原因を短く示す
    try {
      await prisma.$queryRaw`SELECT 1`;
      add('データベースへ接続できる', 'error', true, 'OK');
    } catch (error) {
      const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
      add('データベースへ接続できる', 'error', false, `接続に失敗しました: ${message}`);
      report();
      return;
    }

    const users = await prisma.user.findMany({ select: { id: true, email: true, isActive: true, role: true } });

    const demoUsers = users.filter((u) =>
      DEMO_EMAIL_DOMAINS.some((domain) => u.email.endsWith(`@${domain}`)),
    );
    add(
      'デモ用アカウントが残っていない',
      'error',
      demoUsers.length === 0,
      demoUsers.length === 0 ? 'なし' : `${demoUsers.length} 件: ${demoUsers.map((u) => u.email).join(', ')}`,
    );

    // 既知パスワードのアカウントが残っていないか（ハッシュを実際に検証する）
    const { verifyPassword } = await import('better-auth/crypto');
    const accounts = await prisma.account.findMany({
      where: { providerId: 'credential', password: { not: null } },
      select: { userId: true, password: true },
    });
    const weak: string[] = [];
    for (const account of accounts) {
      if (!account.password) continue;
      const matched = await verifyPassword({ hash: account.password, password: DEFAULT_DEMO_PASSWORD }).catch(() => false);
      if (matched) {
        const user = users.find((u) => u.id === account.userId);
        weak.push(user?.email ?? account.userId);
      }
    }
    add(
      '既知のデモパスワードを使うアカウントが存在しない',
      'error',
      weak.length === 0,
      weak.length === 0 ? 'なし' : `${weak.length} 件: ${weak.join(', ')}`,
    );

    const superAdmins = users.filter((u) => u.role === 'SUPER_ADMIN' && u.isActive);
    add(
      '有効な SUPER_ADMIN が 1 名以上いる',
      'error',
      superAdmins.length >= 1,
      `${superAdmins.length} 名`,
    );

    const orgCount = await prisma.organization.count();
    add('組織が登録されている', 'error', orgCount >= 1, `${orgCount} 件`);

    const pricingRules = await prisma.pricingRule.count();
    const agencyPrices = await prisma.agencyUnitPrice.count();
    add(
      '単価マスタが登録されている',
      'error',
      pricingRules + agencyPrices > 0,
      `pricing_rules ${pricingRules} 件 / agency_unit_prices ${agencyPrices} 件`,
    );

    const statuses = await prisma.contractStatus.count({ where: { isCancelled: true } });
    add('キャンセル用の契約ステータスが存在する', 'error', statuses >= 1, `${statuses} 件`);
  } finally {
    await prisma.$disconnect();
  }

  report();
}

function report() {
  const errors = checks.filter((c) => c.level === 'error' && !c.ok);
  const warns = checks.filter((c) => c.level === 'warn' && !c.ok);

  console.log('\n本番投入前チェック\n');
  for (const check of checks) {
    const mark = check.ok ? '✅' : check.level === 'error' ? '❌' : '⚠️ ';
    console.log(`${mark} ${check.name}  — ${check.detail}`);
  }

  console.log('');
  if (errors.length > 0) {
    console.error(`❌ ${errors.length} 件の重大な問題があります。本番投入前に解消してください。`);
    process.exitCode = 1;
    return;
  }
  if (warns.length > 0) {
    console.warn(`⚠️  ${warns.length} 件の警告があります。内容を確認してください。`);
  }
  console.log('✅ 本番投入前チェックを通過しました。');
}

main().catch((error: unknown) => {
  console.error('チェックの実行に失敗しました:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
