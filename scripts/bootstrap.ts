import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { seedMasters } from '../prisma/seed/masters.js';

/**
 * 本番環境の初期化。
 *
 *   npm run db:bootstrap
 *
 * デモデータ（既知パスワードのアカウント）は一切作らず、
 * 業務に必要なマスタと最初の SUPER_ADMIN だけを作成する。
 *
 * 環境変数:
 *   ADMIN_EMAIL     … 作成する管理者のメールアドレス（必須）
 *   ADMIN_NAME      … 表示名（既定: システム管理者）
 *   ADMIN_PASSWORD  … 初期パスワード（未指定ならランダム生成して表示）
 *   ORG_NAME        … 組織名（既定: 株式会社VIRTUE）
 *
 * 冪等に動作する。既に同じメールのユーザーがいれば作成せず終了する。
 */

const MIN_PASSWORD_LENGTH = 12;

function generatePassword(): string {
  return `${randomBytes(12).toString('base64url')}#Aa1`;
}

function assertStrongPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`ADMIN_PASSWORD は ${MIN_PASSWORD_LENGTH} 文字以上にしてください。`);
  }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) {
    throw new Error('ADMIN_PASSWORD は英大文字・小文字・数字・記号のうち 3 種類以上を含めてください。');
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL が設定されていません。');

  const email = process.env.ADMIN_EMAIL?.trim();
  if (!email) {
    throw new Error('ADMIN_EMAIL を指定してください。例: ADMIN_EMAIL=admin@example.co.jp npm run db:bootstrap');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`ADMIN_EMAIL の形式が不正です: ${email}`);
  }

  const name = process.env.ADMIN_NAME?.trim() || 'システム管理者';
  const generated = !process.env.ADMIN_PASSWORD;
  const password = process.env.ADMIN_PASSWORD ?? generatePassword();
  assertStrongPassword(password);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    console.log('▶ マスタを投入します（契約ステータス・商材・勘定科目など）…');
    const masters = await seedMasters(prisma);

    if (process.env.ORG_NAME?.trim()) {
      await prisma.organization.update({
        where: { id: masters.organizationId },
        data: { name: process.env.ORG_NAME.trim() },
      });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`\n✅ マスタを最新化しました。${email} は既に存在するため作成をスキップしました。`);
      return;
    }

    console.log('▶ 管理者アカウントを作成します…');
    const user = await prisma.user.create({
      data: {
        email,
        name,
        emailVerified: true,
        role: 'SUPER_ADMIN',
        organizationId: masters.organizationId,
        isActive: true,
      },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        providerId: 'credential',
        accountId: user.id,
        password: await hashPassword(password),
      },
    });

    console.log('\n✅ 初期化が完了しました。');
    console.log(`   メールアドレス: ${email}`);
    if (generated) {
      console.log(`   初期パスワード: ${password}`);
      console.log('   ※ この表示は再現できません。控えたうえで、初回ログイン後に必ず変更してください。');
    } else {
      console.log('   パスワード: ADMIN_PASSWORD に指定した値');
    }
    console.log('\n   このあと `npm run preflight` で本番投入前チェックを実行してください。');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('初期化に失敗しました:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
