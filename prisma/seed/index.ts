import { prisma } from './client.js';
import { seedMasters } from './masters.js';
import { seedDemo } from './demo.js';
import { DEMO_PASSWORD, DEMO_PASSWORD_GENERATED } from './users.js';
import { assertSeedAllowed } from './guard.js';

async function main() {
  // 本番DBへ既知パスワードのアカウントを流し込まないためのガード
  assertSeedAllowed();

  console.log('▶ マスタを投入します…');
  const masters = await seedMasters();

  console.log('▶ デモデータを投入します…');
  const demo = await seedDemo(masters);

  const [customers, contracts, leads] = await Promise.all([
    prisma.customer.count(),
    prisma.contract.count(),
    prisma.upsellLead.count(),
  ]);

  console.log('\n✅ シード完了');
  console.log(`   代理店: ${demo.agencies.length} 社 / 催事: ${demo.events.length} 件`);
  console.log(`   顧客: ${customers} 名 / 契約: ${contracts} 件 / アップセル: ${leads} 件`);
  console.log('\n   テストユーザー（開発・検証専用。本番では使用しないこと）');
  console.log(`   パスワード: ${DEMO_PASSWORD}${DEMO_PASSWORD_GENERATED ? '  ← ランダム生成（この表示を控えてください）' : ''}`);
  console.log('   - superadmin@virtue.example.jp   システム管理者');
  console.log('   - hq.admin@virtue.example.jp     VIRTUE本部管理者');
  console.log('   - hq.staff@virtue.example.jp     VIRTUE本部スタッフ');
  console.log('   - ag-a.admin@example.jp          代理店A 管理者');
  console.log('   - ag-a.staff@example.jp          代理店A スタッフ');
  console.log('   - ag-b.admin@example.jp          代理店B 管理者');
  console.log('   - ag-c.admin@example.jp          代理店C 管理者');
}

main()
  .catch((error) => {
    console.error('シードに失敗しました', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
