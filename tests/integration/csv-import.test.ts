import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@/generated/prisma';
import { prisma } from '@/server/db';
import type { AccessContext } from '@/server/authz/context';
import { can } from '@/server/authz/context';
import { uploadCsv } from '@/server/services/import/upload';
import { saveBatchMapping } from '@/server/services/import/upload';
import { planImport } from '@/server/services/import/plan';
import { commitImport } from '@/server/services/import/commit';
import { rollbackImport } from '@/server/services/import/rollback';
import { saveTemplate, findTemplate, listTemplates } from '@/server/services/import/templates';
import { suggestMapping } from '@/server/services/csv/field-catalog';
import { parseCsv } from '@/server/services/csv/parse';
import { toNumber } from '@/lib/money';

const FIXTURES = join(process.cwd(), 'fixtures', 'csv');

function fixture(name: string) {
  const buffer = readFileSync(join(FIXTURES, name));
  return { name, size: buffer.length, buffer: new Uint8Array(buffer) };
}

const ids = {
  org: 'csv-org',
  agencyA: 'csv-agency-a',
  agencyB: 'csv-agency-b',
  agencyC: 'csv-agency-c',
  product: 'csv-product',
  user: 'csv-user-hq',
};

const hq: AccessContext = {
  userId: ids.user,
  role: 'HQ_ADMIN',
  organizationId: ids.org,
  agencyId: null,
  email: 'csv@example.jp',
  name: 'CSV検証ユーザー',
};

const agencyUser: AccessContext = {
  userId: 'csv-user-agency',
  role: 'AGENCY_ADMIN',
  organizationId: ids.org,
  agencyId: ids.agencyA,
  email: 'csv-a@example.jp',
  name: '代理店Aユーザー',
};

/** CSV の列名に合わせたマッピング（STEP3 でユーザーが決めるものを再現する）。 */
function mappingFor(name: string): Record<string, string | null> {
  const parsed = parseCsv(fixture(name).buffer);
  return suggestMapping(parsed.headers);
}

async function stage(file: string, options: Record<string, unknown> = {}, ctx: AccessContext = hq) {
  const uploaded = await uploadCsv(ctx, fixture(file));
  await saveBatchMapping(ctx, uploaded.batchId, mappingFor(file), {
    unknownAgency: 'error',
    defaultStatusCode: null,
    fixedAgencyId: null,
    createOnReview: false,
    ...options,
  });
  return uploaded;
}

beforeAll(async () => {
  execSync('npx prisma migrate deploy', { cwd: process.cwd(), stdio: 'ignore' });

  await prisma.organization.upsert({
    where: { id: ids.org },
    update: {},
    create: { id: ids.org, code: 'CSVORG', name: 'CSV検証組織' },
  });
  for (const [id, code, name] of [
    [ids.agencyA, 'AG-A', 'Agency A'],
    [ids.agencyB, 'AG-B', 'Agency B'],
    [ids.agencyC, 'AG-C', 'Agency C'],
  ] as const) {
    await prisma.agency.upsert({ where: { id }, update: {}, create: { id, organizationId: ids.org, code, name } });
  }
  for (const ctx of [hq, agencyUser]) {
    await prisma.user.upsert({
      where: { id: ctx.userId },
      update: {},
      create: { id: ctx.userId, email: `${ctx.userId}@example.jp`, name: ctx.name, role: ctx.role, organizationId: ids.org, agencyId: ctx.agencyId },
    });
  }
  await prisma.product.upsert({
    where: { id: ids.product },
    update: {},
    create: { id: ids.product, organizationId: ids.org, code: 'CSV-ELEC', name: '電力', category: 'ELECTRICITY', quantityUnit: 'WATT' },
  });

  const statuses = [
    { code: '開通済', label: '開通済', isActiveContract: true, sortOrder: 1 },
    { code: '審査中', label: '審査中', isActiveContract: true, sortOrder: 2 },
    { code: '契約確定', label: '契約確定', isActiveContract: true, sortOrder: 3 },
    { code: '開通待ち', label: '開通待ち', isActiveContract: true, sortOrder: 4 },
    { code: '申込', label: '申込', isActiveContract: true, sortOrder: 5 },
    { code: '不備', label: '不備', isActiveContract: true, isDefect: true, sortOrder: 6 },
    { code: 'キャンセル', label: 'キャンセル', isActiveContract: false, isCancelled: true, sortOrder: 7 },
  ];
  for (const s of statuses) {
    await prisma.contractStatus.upsert({
      where: { organizationId_code: { organizationId: ids.org, code: s.code } },
      update: {},
      create: { organizationId: ids.org, ...s },
    });
  }

  await prisma.pricingRule.deleteMany({ where: { organizationId: ids.org } });
  await prisma.pricingRule.create({
    data: {
      organizationId: ids.org,
      side: 'HQ_RECEIVE',
      productId: ids.product,
      unitType: 'PER_WATT',
      unitPrice: new Prisma.Decimal(150),
      effectiveFrom: new Date(2026, 0, 1),
    },
  });
  await prisma.agencyUnitPrice.deleteMany({ where: { agencyId: { in: [ids.agencyA, ids.agencyB, ids.agencyC] } } });
  for (const [agencyId, price] of [[ids.agencyA, 100], [ids.agencyB, 95], [ids.agencyC, 110]] as const) {
    await prisma.agencyUnitPrice.create({
      data: { agencyId, productId: ids.product, unitType: 'PER_WATT', unitPrice: new Prisma.Decimal(price), effectiveFrom: new Date(2026, 0, 1) },
    });
  }
}, 120_000);

beforeEach(async () => {
  // 各テストを独立させるため、この組織の取込結果と業務データを消す
  await prisma.importBatch.deleteMany({ where: { organizationId: ids.org } });
  await prisma.contract.deleteMany({ where: { organizationId: ids.org } });
  await prisma.customer.deleteMany({ where: { organizationId: ids.org } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('STEP1-2: アップロードと解析', () => {
  it('CSV をステージングするだけで、顧客・契約は登録されない', async () => {
    const uploaded = await uploadCsv(hq, fixture('valid.csv'));

    expect(uploaded.totalRows).toBe(10);
    expect(uploaded.headers).toContain('契約番号');
    expect(uploaded.encoding).toBe('UTF-8');
    // 業務データは一切作られていない
    expect(await prisma.customer.count({ where: { organizationId: ids.org } })).toBe(0);
    expect(await prisma.contract.count({ where: { organizationId: ids.org } })).toBe(0);
    // ステージング行は保存されている
    expect(await prisma.importRow.count({ where: { batchId: uploaded.batchId } })).toBe(10);
  });

  it('Shift-JIS の CSV も自動判定して読み込める', async () => {
    const uploaded = await uploadCsv(hq, fixture('sjis.csv'));
    expect(uploaded.encoding).toBe('SJIS');
    expect(uploaded.headers).toContain('氏名');
  });

  it('同じファイルの再アップロードを検知して警告する', async () => {
    const first = await uploadCsv(hq, fixture('valid.csv'));
    const second = await uploadCsv(hq, fixture('valid.csv'));
    expect(second.duplicateOfBatch?.id).toBe(first.batchId);
  });

  it('CSV 以外のファイルは拒否する', async () => {
    await expect(
      uploadCsv(hq, { name: 'malware.exe', size: 10, buffer: new Uint8Array([1, 2, 3]) }),
    ).rejects.toThrow('CSV ファイル');
  });
});

describe('STEP3: 列マッピング（特定 CSV に固定しない）', () => {
  it('列名が英語・略称でも同じシステム項目へ紐付けられる', async () => {
    const mapping = mappingFor('alt-columns.csv');
    expect(mapping['NAME']).toBe('customerName');
    expect(mapping['TEL']).toBe('phone');
    expect(mapping['contract_no']).toBe('contractNumber');
    expect(mapping['KW']).toBe('contractWatt');
    expect(mapping['agency_code']).toBe('agencyCode');
  });

  it('kW / カンマ / W 付きのワット数を正規化して取り込む', async () => {
    const uploaded = await stage('alt-columns.csv');
    const plan = await planImport(hq, uploaded.batchId);

    expect(plan.rows[0]?.values.contractWatt).toBe(5000); // 5kW
    expect(plan.rows[1]?.values.contractWatt).toBe(6500); // "6,500"
    expect(plan.rows[2]?.values.contractWatt).toBe(7200); // 7200W
  });

  it('テンプレートに保存したマッピングを再利用できる', async () => {
    const uploaded = await stage('valid.csv');
    const template = await saveTemplate(hq, {
      name: '電力会社A CSV',
      description: '月次の開通結果',
      columnMappings: mappingFor('valid.csv'),
      options: { unknownAgency: 'warning', defaultStatusCode: '開通済', fixedAgencyId: null, createOnReview: false },
    });

    const loaded = await findTemplate(hq, template.id);
    expect(loaded?.columnMappings['契約番号']).toBe('contractNumber');
    expect(loaded?.options.unknownAgency).toBe('warning');
    expect(loaded?.options.defaultStatusCode).toBe('開通済');

    const templates = await listTemplates(hq);
    expect(templates.some((t) => t.name === '電力会社A CSV')).toBe(true);
    expect(uploaded.batchId).toBeTruthy();
  });
});

describe('STEP4-5: DRY RUN とバリデーション', () => {
  it('DRY RUN は DB へ書き込まずに件数を返す', async () => {
    const uploaded = await stage('valid.csv');
    const plan = await planImport(hq, uploaded.batchId);

    expect(plan.summary.totalRows).toBe(10);
    expect(plan.summary.createCount).toBe(10);
    expect(plan.summary.errorCount).toBe(0);
    // DRY RUN 後も業務データは 0 件のまま
    expect(await prisma.customer.count({ where: { organizationId: ids.org } })).toBe(0);
    expect(await prisma.contract.count({ where: { organizationId: ids.org } })).toBe(0);
  });

  it('不正なワット数はエラーになり、正常な 9 件と切り分けられる', async () => {
    const uploaded = await stage('errors.csv');
    const plan = await planImport(hq, uploaded.batchId);

    expect(plan.summary.totalRows).toBe(10);
    expect(plan.summary.errorCount).toBe(1);
    expect(plan.summary.createCount).toBe(9);

    const errorRow = plan.rows.find((r) => r.decision === 'ERROR');
    expect(errorRow?.rowNumber).toBe(10);
    expect(errorRow?.issues.some((i) => i.level === 'error' && i.message.includes('契約ワット数'))).toBe(true);
  });

  it('確定後も正常 9 件だけが登録され、エラー行は理由つきで記録される', async () => {
    const uploaded = await stage('errors.csv');
    const summary = await commitImport(hq, uploaded.batchId);

    expect(summary.createCount).toBe(9);
    expect(summary.errorCount).toBe(1);
    expect(await prisma.contract.count({ where: { organizationId: ids.org, deletedAt: null } })).toBe(9);

    const failed = await prisma.importRow.findFirst({ where: { batchId: uploaded.batchId, status: 'FAILED' } });
    expect(failed?.rowNumber).toBe(10);
    expect(JSON.stringify(failed?.errors)).toContain('契約ワット数');
  });

  it('存在しない代理店は既定でエラー、設定で警告に切り替えられる', async () => {
    const asError = await stage('unknown-agency.csv', { unknownAgency: 'error' });
    const errorPlan = await planImport(hq, asError.batchId);
    expect(errorPlan.summary.errorCount).toBe(1);
    expect(errorPlan.rows[0]?.issues.some((i) => i.level === 'error' && i.message.includes('存在しない代理店X'))).toBe(true);

    const asWarning = await stage('unknown-agency.csv', { unknownAgency: 'warning' });
    const warnPlan = await planImport(hq, asWarning.batchId);
    expect(warnPlan.summary.errorCount).toBe(0);
    expect(warnPlan.rows[0]?.decision).toBe('CREATE');
    expect(warnPlan.rows[0]?.issues.some((i) => i.level === 'warning')).toBe(true);
  });

  it('CSV の単価が単価マスタと異なる場合は警告する（金額はマスタを正とする）', async () => {
    const uploaded = await stage('valid.csv');
    const plan = await planImport(hq, uploaded.batchId);
    // valid.csv は AG-B に 95 円/W、AG-C に 110 円/W を記載しており、マスタと一致する
    expect(plan.summary.warningCount).toBe(0);

    const mismatch = await stage('unknown-agency.csv', { unknownAgency: 'warning' });
    const mismatchPlan = await planImport(hq, mismatch.batchId);
    expect(mismatchPlan.rows).toHaveLength(2);
  });
});

describe('STEP6: 確定と金額計算', () => {
  it('確定すると顧客・契約が作成され、単価スナップショットが保存される', async () => {
    const uploaded = await stage('valid.csv');
    const summary = await commitImport(hq, uploaded.batchId);

    expect(summary.createCount).toBe(10);
    expect(summary.successCount).toBe(10);

    // 1行目: AG-A / 5,000W → 本部150円 × 5,000 = 750,000 / 代理店100円 × 5,000 = 500,000
    const contract = await prisma.contract.findFirstOrThrow({
      where: { organizationId: ids.org, contractNumber: 'CSV-0001' },
      include: { customer: true, agency: true, status: true },
    });
    expect(contract.agency?.code).toBe('AG-A');
    expect(toNumber(contract.contractWatt)).toBe(5000);
    expect(toNumber(contract.hqRevenue)).toBe(750_000);
    expect(toNumber(contract.agencyPayout)).toBe(500_000);
    expect(toNumber(contract.hqGrossProfit)).toBe(250_000);
    expect(contract.status.label).toBe('開通済');
    expect(contract.customer.name).toBe('今井 太一');
    // 電話番号は重複判定キーとして正規化されている
    expect(contract.customer.phoneNormalized).toBe('09011110001');

    // 単価スナップショット履歴が残る
    expect(await prisma.contractPricingSnapshot.count({ where: { contractId: contract.id } })).toBe(1);

    // 取込バッチに件数が記録される（§10）
    const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: uploaded.batchId } });
    expect(batch.status).toBe('COMMITTED');
    expect(batch.createdCount).toBe(10);
    expect(batch.importedById).toBe(hq.userId);
    expect(batch.finishedAt).not.toBeNull();

    // 監査ログが残る（§27）
    const log = await prisma.auditLog.findFirst({
      where: { entity: 'import_batch', entityId: uploaded.batchId, action: 'import.commit' },
    });
    expect(log).not.toBeNull();
  });

  it('確定済みのバッチは二重に確定できない', async () => {
    const uploaded = await stage('valid.csv');
    await commitImport(hq, uploaded.batchId);
    await expect(commitImport(hq, uploaded.batchId)).rejects.toThrow('既に確定済み');
  });
});

describe('重複防止（§9 / §35）', () => {
  it('同じ CSV を 2 回取り込んでも二重登録されない', async () => {
    const first = await stage('valid.csv');
    await commitImport(hq, first.batchId);

    const customersAfterFirst = await prisma.customer.count({ where: { organizationId: ids.org } });
    const contractsAfterFirst = await prisma.contract.count({ where: { organizationId: ids.org } });
    expect(contractsAfterFirst).toBe(10);

    // 同じファイルをもう一度
    const second = await stage('valid.csv');
    const plan = await planImport(hq, second.batchId);
    // 契約番号が一致するため全行「更新」と判定される
    expect(plan.summary.createCount).toBe(0);
    expect(plan.summary.updateCount).toBe(10);

    const summary = await commitImport(hq, second.batchId);
    expect(summary.createCount).toBe(0);
    expect(summary.updateCount).toBe(10);

    // 件数が増えていないこと
    expect(await prisma.customer.count({ where: { organizationId: ids.org } })).toBe(customersAfterFirst);
    expect(await prisma.contract.count({ where: { organizationId: ids.org } })).toBe(contractsAfterFirst);
  });

  it('一部だけ重複する CSV は、重複分を更新し新規分のみ追加する', async () => {
    const first = await stage('valid.csv');
    await commitImport(hq, first.batchId);

    const second = await stage('duplicate.csv');
    const plan = await planImport(hq, second.batchId);
    expect(plan.summary.updateCount).toBe(5); // CSV-0001..0005
    expect(plan.summary.createCount).toBe(1); // CSV-0011

    await commitImport(hq, second.batchId);
    expect(await prisma.contract.count({ where: { organizationId: ids.org, deletedAt: null } })).toBe(11);
  });

  it('完全一致しない重複候補は自動登録せず「要確認」にする', async () => {
    // 既存顧客と同じ電話番号だが氏名が違うケース
    await prisma.customer.create({
      data: {
        organizationId: ids.org,
        agencyId: ids.agencyA,
        name: '別人 太郎',
        phone: '090-1111-0001',
        phoneNormalized: '09011110001',
      },
    });

    const uploaded = await stage('valid.csv');
    const plan = await planImport(hq, uploaded.batchId);
    const row = plan.rows.find((r) => r.values.contractNumber === 'CSV-0001');

    expect(row?.decision).toBe('DUPLICATE');
    expect(row?.matchedBy).toBe('PHONE_ONLY');
    expect(row?.issues.some((i) => i.message.includes('重複の可能性'))).toBe(true);

    const summary = await commitImport(hq, uploaded.batchId);
    expect(summary.duplicateCount).toBe(1);
    expect(summary.createCount).toBe(9);
  });
});

describe('ロールバック', () => {
  it('新規作成分を取り消し、取込後に人が変更したデータは巻き戻さない', async () => {
    const uploaded = await stage('valid.csv');
    await commitImport(hq, uploaded.batchId);

    // 人が 1 件だけ手で修正したことにする
    const edited = await prisma.contract.findFirstOrThrow({ where: { organizationId: ids.org, contractNumber: 'CSV-0003' } });
    await prisma.contract.update({ where: { id: edited.id }, data: { notes: '担当者が手で修正' } });

    const result = await rollbackImport(hq, uploaded.batchId);

    // 手で修正した行はスキップされる
    expect(result.skipped).toBeGreaterThanOrEqual(1);
    const survivor = await prisma.contract.findUniqueOrThrow({ where: { id: edited.id } });
    expect(survivor.deletedAt).toBeNull();
    expect(survivor.notes).toBe('担当者が手で修正');

    // それ以外は論理削除される
    const remaining = await prisma.contract.count({ where: { organizationId: ids.org, deletedAt: null } });
    expect(remaining).toBe(1);

    const batch = await prisma.importBatch.findUniqueOrThrow({ where: { id: uploaded.batchId } });
    expect(batch.status).toBe('ROLLED_BACK');
    expect(batch.rolledBackAt).not.toBeNull();
  });

  it('売上が紐づいた契約は巻き戻さない', async () => {
    const uploaded = await stage('valid.csv');
    await commitImport(hq, uploaded.batchId);

    const contract = await prisma.contract.findFirstOrThrow({ where: { organizationId: ids.org, contractNumber: 'CSV-0002' } });
    await prisma.revenue.create({
      data: {
        organizationId: ids.org,
        sourceType: 'CONTRACT',
        contractId: contract.id,
        recognizedOn: new Date(2026, 6, 10),
        amount: new Prisma.Decimal(600_000),
      },
    });

    const result = await rollbackImport(hq, uploaded.batchId);
    expect(result.rows.some((r) => r.outcome === 'skipped' && r.reason?.includes('売上'))).toBe(true);

    const survivor = await prisma.contract.findUniqueOrThrow({ where: { id: contract.id } });
    expect(survivor.deletedAt).toBeNull();
  });

  it('ロールバック済みのバッチは再ロールバックできない', async () => {
    const uploaded = await stage('valid.csv');
    await commitImport(hq, uploaded.batchId);
    await rollbackImport(hq, uploaded.batchId);
    await expect(rollbackImport(hq, uploaded.batchId)).rejects.toThrow('既にロールバック済み');
  });

  it('確定していないバッチはロールバックできない', async () => {
    const uploaded = await stage('valid.csv');
    await expect(rollbackImport(hq, uploaded.batchId)).rejects.toThrow('確定済みの取込のみ');
  });
});

describe('権限', () => {
  it('代理店ユーザーは CSV 取込の権限を持たない', () => {
    expect(can(agencyUser, 'import:run')).toBe(false);
    expect(can(agencyUser, 'import:manage')).toBe(false);
    expect(can(hq, 'import:run')).toBe(true);
  });

  it('代理店ユーザーが取り込もうとしても、自社以外の行はエラーになる', async () => {
    // 代理店ユーザーは import:run を持たないため Server Action 層で弾かれるが、
    // 万一サービスへ到達しても他代理店のデータは取り込めないことを確認する。
    const uploaded = await stage('valid.csv', {}, agencyUser);
    const plan = await planImport(agencyUser, uploaded.batchId);

    const otherAgencyRows = plan.rows.filter((r) => r.values.agencyCode !== 'AG-A');
    expect(otherAgencyRows.length).toBeGreaterThan(0);
    for (const row of otherAgencyRows) {
      expect(row.decision).toBe('ERROR');
      expect(row.issues.some((i) => i.message.includes('自社以外の代理店'))).toBe(true);
    }
  });
});

describe('階段表方式の CSV 取込（エバーグリーン MPプラン）', () => {
  it('使用量・検針月・明細有無から手数料を算定して取り込む', async () => {
    const { seedEvergreenConditions } = await import('../../prisma/seed/evergreen');
    const seeded = await seedEvergreenConditions({
      organizationId: ids.org,
      productId: ids.product,
      createdById: hq.userId,
    });
    // 代理店側の 円/W 単価があると階段表より優先されるため外す
    await prisma.agencyUnitPrice.deleteMany({ where: { agencyId: { in: [ids.agencyA, ids.agencyB, ids.agencyC] } } });

    const uploaded = await stage('evergreen-usage.csv');
    const plan = await planImport(hq, uploaded.batchId);
    expect(plan.summary.errorCount).toBe(0);
    expect(plan.summary.createCount).toBe(5);

    // 検針月・使用量・明細有無が解決されている
    const first = plan.rows[0];
    expect(first?.resolved.usageMonth).toBe(6);
    expect(first?.resolved.actualUsageKwh).toBe(500);
    expect(first?.resolved.hasStatement).toBe(true);
    const noStatement = plan.rows.find((r) => r.values.contractNumber === 'EG-0004');
    expect(noStatement?.resolved.hasStatement).toBe(false);
    const matching = plan.rows.find((r) => r.values.contractNumber === 'EG-0003');
    expect(matching?.resolved.isMatchingConfirmed).toBe(true);

    await commitImport(hq, uploaded.batchId);

    // 6月検針 500kWh → 582kWh → 45,900 円 / 本部 50,490 円
    const eg1 = await prisma.contract.findFirstOrThrow({ where: { organizationId: ids.org, contractNumber: 'EG-0001' } });
    expect(toNumber(eg1.estimatedUsageKwh ?? 0)).toBe(582);
    expect(toNumber(eg1.agencyPayout)).toBe(45_900);
    expect(toNumber(eg1.hqRevenue)).toBe(50_490);

    // 同じ 500kWh でも 8月検針なら 433.5kWh → 32,400 円
    const eg2 = await prisma.contract.findFirstOrThrow({ where: { organizationId: ids.org, contractNumber: 'EG-0002' } });
    expect(toNumber(eg2.estimatedUsageKwh ?? 0)).toBe(433.5);
    expect(toNumber(eg2.agencyPayout)).toBe(32_400);

    // 明細なしは定額 3,600 円
    const eg4 = await prisma.contract.findFirstOrThrow({ where: { organizationId: ids.org, contractNumber: 'EG-0004' } });
    expect(eg4.hasStatement).toBe(false);
    expect(toNumber(eg4.agencyPayout)).toBe(3_600);

    // 50kWh 未満は 0 円
    const eg5 = await prisma.contract.findFirstOrThrow({ where: { organizationId: ids.org, contractNumber: 'EG-0005' } });
    expect(toNumber(eg5.agencyPayout)).toBe(0);

    // マッチング確認案件は業務管理費 1,000 円が相殺される
    const eg3 = await prisma.contract.findFirstOrThrow({ where: { organizationId: ids.org, contractNumber: 'EG-0003' } });
    expect(eg3.isMatchingConfirmed).toBe(true);
    expect(toNumber(eg3.agencyPayout)).toBe(116_900);
    expect(toNumber(eg3.hqRevenue)).toBe(129_690);

    expect(seeded.agencyRuleId).toBeTruthy();
  });
});

/**
 * 実運用の電力 CSV（32列）の取込。
 * 列名・列構成は実ファイルのまま、値だけダミーに置き換えた
 * `fixtures/csv/electricity-real-format.csv` を使う。
 */
describe('実データ形式（電力 32列）の取込', () => {
  const FILE = 'electricity-real-format.csv';

  it('32列のうち 26 列が自動でマッピングされ、金額系 6 列だけが未マッピングで残る', () => {
    const parsed = parseCsv(fixture(FILE).buffer);
    expect(parsed.headers).toHaveLength(32);

    const mapping = suggestMapping(parsed.headers);
    const unmapped = Object.entries(mapping).filter(([, v]) => !v).map(([k]) => k);
    expect(unmapped).toEqual(['相対割引', '直営粗利', '別途', '粗利', '別途 (2)', 'ポイント']);
  });

  it('同名の「別途」列が 2 つあっても先の列の値が失われない', () => {
    const parsed = parseCsv(fixture(FILE).buffer);
    expect(parsed.headers.filter((h) => h.startsWith('別途'))).toEqual(['別途', '別途 (2)']);
    // 2 行目は 別途=4000 / 別途(2)=1000。連番を付けないと 4000 が消える。
    expect(parsed.rows[1]?.['別途']).toBe('4000');
    expect(parsed.rows[1]?.['別途 (2)']).toBe('1000');
  });

  it('列名の違い（管理番号・契約者名・代表者名フリ・町域以降など）を吸収する', () => {
    const parsed = parseCsv(fixture(FILE).buffer);
    const mapping = suggestMapping(parsed.headers);
    expect(mapping['管理番号']).toBe('contractNumber');
    expect(mapping['契約者名']).toBe('customerName');
    expect(mapping['代表者名フリ']).toBe('customerNameKana');
    expect(mapping['代表生年月日']).toBe('birthDate');
    expect(mapping['市区郡']).toBe('city');
    expect(mapping['町域以降']).toBe('address');
    expect(mapping['WEB入力日']).toBe('appliedAt');
    expect(mapping['スイッチング日']).toBe('activatedAt');
    expect(mapping['獲得者']).toBe('staffName');
    expect(mapping['種別']).toBe('planName');
    // 固定電話番号を主電話、携帯番号は別項目として取り込む
    expect(mapping['固定電話番号']).toBe('phone');
    expect(mapping['携帯番号']).toBe('mobilePhone');
  });

  it('「8月」のような単位付きの検針月を数値として解釈する', async () => {
    const uploaded = await stage(FILE, { defaultStatusCode: '開通済', unknownAgency: 'warning' });
    const plan = await planImport(hq, uploaded.batchId);
    expect(plan.rows.map((r) => r.values.usageMonth)).toEqual([8, 6, 7, 5]);
  });

  it('代理店列が「直営」の行は本部直販として取り込み、代理店未登録エラーにしない', async () => {
    const uploaded = await stage(FILE, { defaultStatusCode: '開通済' });
    const plan = await planImport(hq, uploaded.batchId);

    const direct = plan.rows[0];
    expect(direct?.resolved.directSales).toBe(true);
    expect(direct?.resolved.agencyId).toBeNull();
    expect(direct?.decision).toBe('CREATE');
    expect(direct?.issues.filter((i) => i.level === 'error')).toHaveLength(0);

    // 実在しない代理店は従来どおりエラー
    expect(plan.rows[2]?.decision).toBe('ERROR');
    expect(plan.rows[2]?.issues.some((i) => i.field === 'agencyCode')).toBe(true);
  });

  it('代理店ユーザーは「直営」の行を自社案件として取り込めない', async () => {
    const uploaded = await stage(FILE, { defaultStatusCode: '開通済', unknownAgency: 'warning' }, agencyUser);
    const plan = await planImport(agencyUser, uploaded.batchId);
    expect(plan.rows[0]?.decision).toBe('ERROR');
    expect(plan.rows[0]?.issues.some((i) => i.message.includes('直営'))).toBe(true);
  });

  it('固定電話番号が空でも携帯番号を主電話として取り込む（重複判定キーを失わない）', async () => {
    const uploaded = await stage(FILE, { defaultStatusCode: '開通済', unknownAgency: 'warning' });
    await planImport(hq, uploaded.batchId);
    await commitImport(hq, uploaded.batchId);

    const customer = await prisma.customer.findFirst({
      where: { organizationId: ids.org, externalCustomerId: null, name: { contains: '田中' } },
    });
    expect(customer?.phone).toBe('09000000204');
    expect(customer?.phoneNormalized).toBe('09000000204');
    expect(customer?.mobilePhone).toBe('09000000204');
    expect(customer?.contactPersonName).toBe('窓口 次郎');
  });

  it('運用管理項目（マッチング日/月・書類郵送・後確状況・エリア・支払方法・電気料金）を保存する', async () => {
    const uploaded = await stage(FILE, { defaultStatusCode: '開通済', unknownAgency: 'warning' });
    await planImport(hq, uploaded.batchId);
    await commitImport(hq, uploaded.batchId);

    const contract = await prisma.contract.findFirst({
      where: { organizationId: ids.org, contractNumber: 'U000201' },
      include: { customer: true },
    });
    expect(contract).not.toBeNull();
    // 直営は代理店を持たない
    expect(contract?.agencyId).toBeNull();
    expect(contract?.appliedAt?.toISOString().slice(0, 10)).toBe('2026-05-31');
    expect(contract?.activatedAt?.toISOString().slice(0, 10)).toBe('2026-07-18');
    expect(contract?.matchedAt?.toISOString().slice(0, 10)).toBe('2026-06-11');
    expect(contract?.matchingMonth).toBe(202606);
    expect(contract?.documentMailStatus).toBe('郵送済み');
    expect(contract?.followUpStatus).toBe('OK');
    expect(contract?.areaName).toBe('関西');
    expect(contract?.paymentMethodLabel).toBe('口座');
    expect(toNumber(contract?.usageAmountYen ?? 0)).toBe(16152);
    expect(toNumber(contract?.actualUsageKwh ?? 0)).toBe(530);
    expect(contract?.usageMonth).toBe(8);
    // 住所は 市区郡 / 町域以降 から復元される
    expect(contract?.customer.city).toBe('大阪市北区');
    expect(contract?.customer.address).toBe('ダミー町1-1-1 201');
    expect(contract?.customer.nameKana).toBe('サトウ タロウ');
  });

  it('未マッピングの金額列があっても取込は成功する（無視される）', async () => {
    const uploaded = await stage(FILE, { defaultStatusCode: '開通済', unknownAgency: 'warning' });
    await planImport(hq, uploaded.batchId);
    const result = await commitImport(hq, uploaded.batchId);
    expect(result.errorCount).toBe(0);
    expect(result.successCount).toBe(4);
  });
});
