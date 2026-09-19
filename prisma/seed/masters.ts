import { prisma as defaultPrisma } from './client.js';
import type { PrismaClient } from '../../src/generated/prisma/index.js';

export const ORG_CODE = 'VIRTUE';

/**
 * マスタ投入。単価はここではなく pricing_rules / agency_unit_prices に入れる。
 *
 * デモデータを含まないため**本番環境でも安全に実行できる**
 * （`scripts/bootstrap.ts` から呼ばれる）。
 * 接続先を差し替えられるよう PrismaClient を引数で受け取る。
 */
export async function seedMasters(prisma: PrismaClient = defaultPrisma) {
  const organization = await prisma.organization.upsert({
    where: { code: ORG_CODE },
    update: {},
    create: { code: ORG_CODE, name: '株式会社VIRTUE' },
  });
  const organizationId = organization.id;

  // ── 商材（電力専用に固定しない。将来商材を足せる構造 §37/§63）──
  const productSeeds = [
    { code: 'ELEC', name: '電力', category: 'ELECTRICITY', quantityUnit: 'WATT', isUpsell: false, sortOrder: 1 },
    { code: 'SOLAR', name: '太陽光発電', category: 'SOLAR', quantityUnit: 'AMOUNT', isUpsell: true, sortOrder: 2 },
    { code: 'BATTERY', name: '家庭用蓄電池', category: 'BATTERY', quantityUnit: 'AMOUNT', isUpsell: true, sortOrder: 3 },
    { code: 'SOLAR_BATTERY', name: '太陽光＋蓄電池', category: 'SOLAR_BATTERY', quantityUnit: 'AMOUNT', isUpsell: true, sortOrder: 4 },
  ] as const;

  const products: Record<string, string> = {};
  for (const p of productSeeds) {
    const row = await prisma.product.upsert({
      where: { organizationId_code: { organizationId, code: p.code } },
      update: { name: p.name },
      create: { organizationId, ...p },
    });
    products[p.code] = row.id;
  }

  // ── 電力会社 / プラン ──
  const supplierSeeds = [
    { code: 'PWR_A', name: 'グリーン電力A', plans: ['スタンダードプラン', 'オール電化プラン'] },
    { code: 'PWR_B', name: 'エコエナジーB', plans: ['ファミリープラン'] },
  ];
  const suppliers: Record<string, string> = {};
  const plans: Record<string, string> = {};
  for (const s of supplierSeeds) {
    const supplier = await prisma.supplier.upsert({
      where: { organizationId_code: { organizationId, code: s.code } },
      update: { name: s.name },
      create: { organizationId, code: s.code, name: s.name },
    });
    suppliers[s.code] = supplier.id;
    for (const [index, planName] of s.plans.entries()) {
      const code = `${s.code}_P${index + 1}`;
      const plan = await prisma.plan.upsert({
        where: { supplierId_code: { supplierId: supplier.id, code } },
        update: { name: planName },
        create: { supplierId: supplier.id, productId: products.ELEC, code, name: planName },
      });
      plans[code] = plan.id;
    }
  }

  // ── 契約ステータス（§13。マスタ管理・追加可）──
  const contractStatusSeeds = [
    { code: 'APPLIED', label: '申込', sortOrder: 1, isActiveContract: true, color: 'slate' },
    { code: 'SCREENING', label: '審査中', sortOrder: 2, isActiveContract: true, color: 'blue' },
    { code: 'CONFIRMED', label: '契約確定', sortOrder: 3, isActiveContract: true, color: 'blue' },
    { code: 'WAITING_ACTIVATION', label: '開通待ち', sortOrder: 4, isActiveContract: true, color: 'blue' },
    { code: 'ACTIVATED', label: '開通済', sortOrder: 5, isActiveContract: true, isTerminal: true, color: 'green' },
    { code: 'CANCELLED', label: 'キャンセル', sortOrder: 6, isActiveContract: false, isCancelled: true, isTerminal: true, color: 'red' },
    { code: 'DEFECT', label: '不備', sortOrder: 7, isActiveContract: true, isDefect: true, color: 'amber' },
    { code: 'ON_HOLD', label: '保留', sortOrder: 8, isActiveContract: true, color: 'amber' },
  ];
  const contractStatuses: Record<string, string> = {};
  for (const s of contractStatusSeeds) {
    const row = await prisma.contractStatus.upsert({
      where: { organizationId_code: { organizationId, code: s.code } },
      update: { label: s.label, sortOrder: s.sortOrder },
      create: { organizationId, ...s },
    });
    contractStatuses[s.code] = row.id;
  }

  // ── アップセルステータス（§19。funnelStage が KPI 定義と対応）──
  const upsellStatusSeeds = [
    { code: 'NEW', label: '未対応', sortOrder: 1, funnelStage: 'TARGET', color: 'slate' },
    { code: 'CALL_SCHEDULED', label: '架電予定', sortOrder: 2, funnelStage: 'TARGET', color: 'slate' },
    { code: 'CALLING', label: '架電中', sortOrder: 3, funnelStage: 'CALLED', color: 'blue' },
    { code: 'NO_ANSWER', label: '不通', sortOrder: 4, funnelStage: 'CALLED', color: 'slate' },
    { code: 'CALL_AGAIN', label: '再架電', sortOrder: 5, funnelStage: 'CALLED', color: 'blue' },
    { code: 'NOT_INTERESTED', label: '興味なし', sortOrder: 6, funnelStage: 'CONNECTED', color: 'slate' },
    { code: 'INTERESTED', label: '興味あり', sortOrder: 7, funnelStage: 'INTERESTED', color: 'blue' },
    { code: 'HEARING_DONE', label: 'ヒアリング済', sortOrder: 8, funnelStage: 'INTERESTED', color: 'blue' },
    { code: 'APPOINTMENT', label: 'アポイント獲得', sortOrder: 9, funnelStage: 'APPOINTMENT', color: 'blue' },
    { code: 'TOSSED_UP', label: 'トスアップ済', sortOrder: 10, funnelStage: 'TOSSUP', color: 'blue' },
    { code: 'NEGOTIATING', label: '商談中', sortOrder: 11, funnelStage: 'MEETING', color: 'amber' },
    { code: 'QUOTED', label: '見積提出', sortOrder: 12, funnelStage: 'MEETING', color: 'amber' },
    { code: 'WON', label: '成約', sortOrder: 13, funnelStage: 'WON', isWon: true, color: 'green' },
    { code: 'LOST', label: '失注', sortOrder: 14, funnelStage: 'LOST', isLost: true, color: 'red' },
    { code: 'EXCLUDED', label: '対象外', sortOrder: 15, funnelStage: 'EXCLUDED', isLost: true, color: 'slate' },
  ] as const;
  const upsellStatuses: Record<string, string> = {};
  for (const s of upsellStatusSeeds) {
    const row = await prisma.upsellStatus.upsert({
      where: { organizationId_code: { organizationId, code: s.code } },
      update: { label: s.label, sortOrder: s.sortOrder },
      create: { organizationId, ...s },
    });
    upsellStatuses[s.code] = row.id;
  }

  // ── ブース立地タグ（§42）──
  const boothTagSeeds = [
    'ENTRANCE:入口付近', 'EXIT:出口付近', 'ESCALATOR:エスカレーター付近', 'ELEVATOR:エレベーター付近',
    'FOOD:食品売場付近', 'SUPER_ENTRANCE:スーパー入口', 'FOOD_COURT:フードコート付近',
    'EVENT_SPACE:イベントスペース', 'AISLE_CENTER:通路中央', 'CASHIER:レジ付近',
    'SPECIALTY:専門店街', 'OTHER:その他',
  ];
  const boothTags: Record<string, string> = {};
  for (const [index, entry] of boothTagSeeds.entries()) {
    const [code, label] = entry.split(':') as [string, string];
    const row = await prisma.boothTag.upsert({
      where: { organizationId_code: { organizationId, code } },
      update: { label },
      create: { organizationId, code, label, sortOrder: index + 1 },
    });
    boothTags[code] = row.id;
  }

  // ── 勘定科目（§74 会計CSV 出力用）──
  const accountingSeeds = [
    { code: '5110', name: '仕入高', subName: '代理店支払', department: '営業' },
    { code: '6110', name: '販売促進費', department: '営業' },
    { code: '6120', name: '地代家賃', subName: 'ブース代', department: '営業' },
    { code: '6210', name: '給料手当', department: '営業' },
    { code: '6220', name: '雑給', subName: 'アルバイト', department: '営業' },
    { code: '6310', name: '旅費交通費', department: '営業' },
    { code: '6320', name: '宿泊費', department: '営業' },
    { code: '6410', name: '通信費', department: '管理' },
    { code: '6900', name: '雑費', department: '管理' },
  ];
  const accounting: Record<string, string> = {};
  for (const [index, a] of accountingSeeds.entries()) {
    const row = await prisma.accountingCategory.upsert({
      where: { organizationId_code: { organizationId, code: a.code } },
      update: { name: a.name },
      create: { organizationId, sortOrder: index + 1, ...a },
    });
    accounting[a.code] = row.id;
  }

  // ── 経費カテゴリ（§44。plGroup が催事PLの行に対応）──
  const expenseCategorySeeds = [
    { code: 'BOOTH_FEE', name: 'ブース代', plGroup: 'BOOTH', acc: '6120' },
    { code: 'FACILITY_FEE', name: '施設利用料', plGroup: 'BOOTH', acc: '6120' },
    { code: 'SETUP', name: '設営費', plGroup: 'BOOTH', acc: '6120' },
    { code: 'TEARDOWN', name: '撤去費', plGroup: 'BOOTH', acc: '6120' },
    { code: 'LABOR', name: '人件費', plGroup: 'LABOR', acc: '6210' },
    { code: 'LABOR_PART', name: 'アルバイト人件費', plGroup: 'LABOR', acc: '6220' },
    { code: 'LABOR_AGENCY', name: '代理店人件費', plGroup: 'LABOR', acc: '6220' },
    { code: 'TRAVEL', name: '交通費', plGroup: 'TRAVEL', acc: '6310' },
    { code: 'SHINKANSEN', name: '新幹線', plGroup: 'TRAVEL', acc: '6310' },
    { code: 'FLIGHT', name: '航空券', plGroup: 'TRAVEL', acc: '6310' },
    { code: 'HIGHWAY', name: '高速代', plGroup: 'TRAVEL', acc: '6310' },
    { code: 'GASOLINE', name: 'ガソリン代', plGroup: 'TRAVEL', acc: '6310' },
    { code: 'PARKING', name: '駐車場代', plGroup: 'TRAVEL', acc: '6310' },
    { code: 'RENTACAR', name: 'レンタカー', plGroup: 'TRAVEL', acc: '6310' },
    { code: 'HOTEL', name: 'ホテル・宿泊費', plGroup: 'LODGING', acc: '6320' },
    { code: 'MEAL', name: '食費', plGroup: 'OTHER', acc: '6900' },
    { code: 'SUPPLIES', name: '備品', plGroup: 'OTHER', acc: '6900' },
    { code: 'PROMOTION', name: '販促物', plGroup: 'PROMOTION', acc: '6110' },
    { code: 'PRINTING', name: '印刷費', plGroup: 'PROMOTION', acc: '6110' },
    { code: 'GIFT', name: '景品', plGroup: 'PROMOTION', acc: '6110' },
    { code: 'COMMUNICATION', name: '通信費', plGroup: 'OTHER', acc: '6410' },
    { code: 'OTHER', name: 'その他', plGroup: 'OTHER', acc: '6900' },
  ];
  const expenseCategories: Record<string, string> = {};
  for (const [index, c] of expenseCategorySeeds.entries()) {
    const row = await prisma.expenseCategory.upsert({
      where: { organizationId_code: { organizationId, code: c.code } },
      update: { name: c.name, plGroup: c.plGroup },
      create: {
        organizationId,
        code: c.code,
        name: c.name,
        plGroup: c.plGroup,
        sortOrder: index + 1,
        accountingCategoryId: accounting[c.acc] ?? null,
      },
    });
    expenseCategories[c.code] = row.id;
  }

  // ── 取引先（トスアップ先 / 経費先）──
  const partnerSeeds = [
    { code: 'SOLAR_CO_1', name: 'サンライズソーラー株式会社', kinds: ['TOSSUP'] as const },
    { code: 'SOLAR_CO_2', name: '株式会社エコバッテリー', kinds: ['TOSSUP'] as const },
    { code: 'VENDOR_1', name: 'イベント資材サプライ株式会社', kinds: ['VENDOR'] as const },
  ];
  const partners: Record<string, string> = {};
  for (const p of partnerSeeds) {
    const row = await prisma.partner.upsert({
      where: { organizationId_code: { organizationId, code: p.code } },
      update: { name: p.name },
      create: { organizationId, code: p.code, name: p.name, kinds: [...p.kinds] },
    });
    partners[p.code] = row.id;
  }

  return { organizationId, products, suppliers, plans, contractStatuses, upsellStatuses, boothTags, expenseCategories, accounting, partners };
}

export type Masters = Awaited<ReturnType<typeof seedMasters>>;
