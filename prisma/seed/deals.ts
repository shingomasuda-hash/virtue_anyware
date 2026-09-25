import { readFileSync } from 'node:fs';
import Papa from 'papaparse';
import { Prisma } from '../../src/generated/prisma/index.js';
import { prisma } from './client.js';
import { calcCompensation } from '../../src/server/services/deals/compensation.js';
import type { Masters } from './masters.js';

/**
 * 案件管理（太陽光・蓄電池）のデモデータ。
 *
 * 元データは `prisma/seed/data/*.csv`（現行 Google スプレッドシートの書き出し）。
 * すべて架空のダミーデータで、実在の顧客情報は含まない。
 *
 * 報酬の金額は CSV の計算済み列を写すのではなく、
 * **入力値（原価・控除額・率）から `calcCompensation()` で計算し直して保存する**。
 * こうすることでシードが計算ロジックの実地検証にもなる。
 */

function readCsv<T>(name: string): T[] {
  const csv = readFileSync(new URL(`./data/${name}`, import.meta.url), 'utf8');
  return Papa.parse<T>(csv, { header: true, skipEmptyLines: true }).data;
}

/** `YYYY-MM-DD` → Date（ローカル 00:00）。空文字は null。 */
function toDate(value: string | undefined): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toDecimal(value: string | undefined): Prisma.Decimal | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? new Prisma.Decimal(n) : null;
}

function toNumber(value: string | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

const STATUS_BY_LABEL: Record<string, string> = {
  アポ取得: 'APPOINTMENT',
  商談予定: 'MEETING_SCHEDULED',
  商談前キャンセル: 'CANCELLED_BEFORE_MEETING',
  提案中: 'PROPOSAL',
  FO: 'FO',
  CLO: 'CLO',
  B: 'B',
  クーリングオフ: 'COOLING_OFF',
  再商談: 'RE_MEETING',
  契約: 'CONTRACTED',
  仮審査中: 'PRE_SCREENING',
  仮審査済: 'PRE_APPROVED',
  本審査中: 'MAIN_SCREENING',
  本審査済: 'MAIN_APPROVED',
  現調待ち: 'SURVEY_PENDING',
  工事待ち: 'CONSTRUCTION_PENDING',
  残工事: 'CONSTRUCTION_PARTIAL',
  完工: 'COMPLETED',
};

const PRIORITY_BY_LABEL = { 高: 'HIGH', 中: 'MEDIUM', 低: 'LOW' } as const;
const PAYMENT_METHOD_BY_LABEL = { 現金: 'CASH', 銀行: 'BANK_TRANSFER', 信販: 'INSTALLMENT' } as const;

const MANUFACTURER_BY_NAME: Record<string, string> = {
  カナディアン: 'MFR_CANADIAN',
  ハンファ: 'MFR_HANWHA',
  SHARP: 'MFR_SHARP',
  長州産業: 'MFR_CHOSHU',
  Panasonic: 'MFR_PANASONIC',
  オムロン: 'MFR_OMRON',
  ニチコン: 'MFR_NICHICON',
  京セラ: 'MFR_KYOCERA',
  ダイヤゼブラ: 'MFR_DIAZEBRA',
  ダイキン: 'MFR_DAIKIN',
  コロナ: 'MFR_CORONA',
};

const FINANCE_BY_NAME: Record<string, string> = {
  滋賀銀行: 'FIN_SHIGA',
  群馬銀行: 'FIN_GUNMA',
  オリコ: 'FIN_ORICO',
  ジャックス: 'FIN_JACCS',
};

/** シート上の代理店名 → 代理店コード。「自社」は本部直販なのでコードを持たない。 */
const AGENCY_CODE_BY_NAME: Record<string, string | null> = {
  代理店A: 'AG-A',
  代理店B: 'AG-B',
  代理店C: 'AG-C',
  代理店D: 'AG-D',
  紹介店A: 'RF-A',
  自社: null,
};

const LOAN_REVIEW = {
  未対応: 'NOT_STARTED',
  対応中: 'IN_PROGRESS',
  仮審査済: 'PRE_APPROVED',
  本審査中: 'MAIN_SCREENING',
  本審査済: 'MAIN_APPROVED',
  否決: 'REJECTED',
  不要: 'NOT_REQUIRED',
} as const;

const SITE_SURVEY = {
  未対応: 'NOT_STARTED',
  日程調整中: 'SCHEDULING',
  予定: 'SCHEDULED',
  完了: 'DONE',
  不要: 'NOT_REQUIRED',
} as const;

const SUBSIDY = {
  不要: 'NOT_REQUIRED',
  確認中: 'CHECKING',
  申請予定: 'PLANNED',
  申請済: 'APPLIED',
  交付決定: 'APPROVED',
  却下: 'REJECTED',
} as const;

const CONSTRUCTION = {
  未対応: 'NOT_STARTED',
  手配中: 'ARRANGING',
  手配済: 'ARRANGED',
  着工: 'IN_PROGRESS',
  完了: 'DONE',
} as const;

const PROGRESS = {
  未対応: 'NOT_STARTED',
  対応中: 'IN_PROGRESS',
  完了: 'DONE',
  不要: 'NOT_REQUIRED',
} as const;

const DEAL_PAYMENT = { 入金待ち: 'PENDING', 一部入金: 'PARTIAL', 入金済: 'PAID' } as const;
const COMPENSATION_PAYMENT = { 支払待ち: 'PENDING', 支払済: 'PAID', 保留: 'ON_HOLD' } as const;

function pick<T extends Record<string, string>>(map: T, value: string | undefined, fallback: T[keyof T]): T[keyof T] {
  if (!value) return fallback;
  return (map[value] ?? fallback) as T[keyof T];
}

interface CustomerRow {
  顧客ID: string;
  氏名: string;
  フリガナ: string;
  電話番号: string;
  メール: string;
  郵便番号: string;
  都道府県: string;
  ' 市区町村・番地': string;
  '市区町村・番地': string;
  DriveフォルダURL: string;
  登録日: string;
  備考: string;
  登録担当: string;
}

interface DealRow {
  案件ID: string;
  顧客ID: string;
  案件ステータス: string;
  CL: string;
  代理店: string;
  AP: string;
  商談日: string;
  商材: string;
  PVメーカー: string;
  'PV容量(kW)': string;
  蓄電池メーカー: string;
  '蓄電池容量(kWh)': string;
  EQメーカー: string;
  契約日: string;
  '販売価格(税抜)': string;
  支払方法: string;
  信販会社: string;
  失注理由: string;
  次回アクション日: string;
  優先度: string;
  備考: string;
}

interface ProgressRow {
  案件ID: string;
  ローン審査: string;
  現調: string;
  現調日: string;
  補助金: string;
  補助金制度: string;
  補助金申請日: string;
  交付決定日: string;
  工事手配: string;
  工事予定日: string;
  工事完了日: string;
  完工確認: string;
  入金予定日: string;
  入金日: string;
  入金状況: string;
  契約書: string;
  重要事項: string;
  保証書: string;
  施工写真: string;
  系統連系: string;
  注意事項: string;
}

interface CompensationRow {
  案件ID: string;
  設備費: string;
  工事代: string;
  延長保証料: string;
  その他原価: string;
  控除額: string;
  営業コミッション率: string;
  代理店コミッション率: string;
  支払予定日: string;
  支払日: string;
  支払状況: string;
  備考: string;
}

export async function seedDeals(masters: Masters) {
  const { organizationId, dealStatuses, manufacturers, batteryModels, partners } = masters;

  const customerRows = readCsv<CustomerRow>('deal-customers.csv');
  const dealRows = readCsv<DealRow>('deals.csv');
  const progressRows = readCsv<ProgressRow>('deal-progress.csv');
  const compensationRows = readCsv<CompensationRow>('deal-compensations.csv');

  // ── 代理店（シートに出てくる 代理店D / 紹介店A を追加。A〜C は既存を流用）──
  const extraAgencies = [
    { code: 'AG-D', name: 'Agency D', corporateName: '株式会社ディーエナジー', prefecture: '京都府', city: '下京区' },
    { code: 'RF-A', name: '紹介店A', corporateName: '紹介店A（ダミー）', prefecture: '兵庫県', city: '西宮市' },
  ];
  for (const a of extraAgencies) {
    await prisma.agency.upsert({
      where: { organizationId_code: { organizationId, code: a.code } },
      update: { name: a.name },
      create: { organizationId, code: a.code, name: a.name, corporateName: a.corporateName, prefecture: a.prefecture, city: a.city },
    });
  }
  const agencies = await prisma.agency.findMany({ where: { organizationId }, select: { id: true, code: true } });
  const agencyIdByCode = new Map(agencies.map((a) => [a.code, a.id]));

  // ── 営業(CL) / アポ(AP) 担当。本部所属（agencyId = NULL）として登録する ──
  const staffIdByName = new Map<string, string>();
  const closerNames = [...new Set(dealRows.map((r) => r.CL).filter(Boolean))].sort();
  const appointerNames = [...new Set(dealRows.map((r) => r.AP).filter(Boolean))].sort();
  for (const [index, name] of closerNames.entries()) {
    const code = `CL-${String(index + 1).padStart(2, '0')}`;
    const row = await prisma.staff.upsert({
      where: { organizationId_code: { organizationId, code } },
      update: { name },
      create: { organizationId, code, name, employmentType: 'EMPLOYEE' },
    });
    staffIdByName.set(name, row.id);
  }
  for (const [index, name] of appointerNames.entries()) {
    const code = `AP-${String(index + 1).padStart(2, '0')}`;
    const row = await prisma.staff.upsert({
      where: { organizationId_code: { organizationId, code } },
      update: { name },
      create: { organizationId, code, name, employmentType: 'PART_TIME' },
    });
    staffIdByName.set(name, row.id);
  }

  // ── 顧客。所属代理店は案件側の代理店に合わせる（1顧客=1案件のダミー構成）──
  const agencyCodeByCustomer = new Map<string, string | null>();
  for (const deal of dealRows) {
    agencyCodeByCustomer.set(deal.顧客ID, AGENCY_CODE_BY_NAME[deal.代理店] ?? null);
  }

  const customerIdByExternalId = new Map<string, string>();
  for (const row of customerRows) {
    const agencyCode = agencyCodeByCustomer.get(row.顧客ID) ?? null;
    const address = row['市区町村・番地'] ?? row[' 市区町村・番地'] ?? '';
    const data = {
      name: row.氏名,
      nameKana: row.フリガナ || null,
      phone: row.電話番号 || null,
      phoneNormalized: row.電話番号 ? row.電話番号.replace(/\D/g, '') : null,
      email: row.メール || null,
      postalCode: row.郵便番号 || null,
      prefecture: row.都道府県 || null,
      address: address || null,
      driveFolderUrl: row.DriveフォルダURL || null,
      registeredByName: row.登録担当 || null,
      acquiredAt: toDate(row.登録日),
      notes: row.備考 || null,
      agencyId: agencyCode ? (agencyIdByCode.get(agencyCode) ?? null) : null,
    };

    const existing = await prisma.customer.findFirst({
      where: { organizationId, externalCustomerId: row.顧客ID },
      select: { id: true },
    });
    const customer = existing
      ? await prisma.customer.update({ where: { id: existing.id }, data })
      : await prisma.customer.create({ data: { organizationId, externalCustomerId: row.顧客ID, ...data } });
    customerIdByExternalId.set(row.顧客ID, customer.id);
  }

  // ── 案件 ──
  const dealIdByCode = new Map<string, string>();
  for (const row of dealRows) {
    const customerId = customerIdByExternalId.get(row.顧客ID);
    const statusCode = STATUS_BY_LABEL[row.案件ステータス];
    if (!customerId || !statusCode) continue;
    const statusId = dealStatuses[statusCode];
    if (!statusId) continue;

    const agencyCode = AGENCY_CODE_BY_NAME[row.代理店] ?? null;
    const pvKey = MANUFACTURER_BY_NAME[row.PVメーカー];
    const btKey = MANUFACTURER_BY_NAME[row.蓄電池メーカー];
    const eqKey = MANUFACTURER_BY_NAME[row.EQメーカー];
    const financeKey = FINANCE_BY_NAME[row.信販会社];

    // 蓄電池容量から型式を引き当てる（シートは案件側に型式列を持たない）
    const capacity = toNumber(row['蓄電池容量(kWh)']);
    const batteryModelCode = Object.entries({
      13.3: 'BT_EPCUBE_133',
      11.2: 'BT_LJB1156',
      9.8: 'BT_KPBU98BS',
      9.5: 'BT_JHWB2021',
      14.9: 'BT_ESST3X1',
      17.1: 'BT_ENEREZZA2',
      7.04: 'BT_EOFLB70TK',
    }).find(([kwh]) => Number(kwh) === capacity)?.[1];

    const data = {
      customerId,
      agencyId: agencyCode ? (agencyIdByCode.get(agencyCode) ?? null) : null,
      statusId,
      closerStaffId: staffIdByName.get(row.CL) ?? null,
      appointerStaffId: staffIdByName.get(row.AP) ?? null,
      productTypes: (row.商材 ? row.商材.split('.') : []) as ('PV' | 'BT' | 'EQ' | 'IH')[],
      pvManufacturerId: pvKey ? (manufacturers[pvKey] ?? null) : null,
      pvCapacityKw: toDecimal(row['PV容量(kW)']),
      batteryManufacturerId: btKey ? (manufacturers[btKey] ?? null) : null,
      batteryModelId: batteryModelCode ? (batteryModels[batteryModelCode] ?? null) : null,
      batteryCapacityKwh: toDecimal(row['蓄電池容量(kWh)']),
      equipmentManufacturerId: eqKey ? (manufacturers[eqKey] ?? null) : null,
      metAt: toDate(row.商談日),
      contractedAt: toDate(row.契約日),
      salesPriceExclTax: toDecimal(row['販売価格(税抜)']),
      paymentMethod: row.支払方法
        ? (PAYMENT_METHOD_BY_LABEL[row.支払方法 as keyof typeof PAYMENT_METHOD_BY_LABEL] ?? null)
        : null,
      financeCompanyId: financeKey ? (partners[financeKey] ?? null) : null,
      lostReason: row.失注理由 || null,
      nextActionAt: toDate(row.次回アクション日),
      priority: pick(PRIORITY_BY_LABEL, row.優先度, 'MEDIUM'),
      notes: row.備考 || null,
    };

    const deal = await prisma.deal.upsert({
      where: { organizationId_code: { organizationId, code: row.案件ID } },
      update: data,
      create: { organizationId, code: row.案件ID, ...data },
    });
    dealIdByCode.set(row.案件ID, deal.id);

    // 再実行で履歴が積み上がらないように作り直す
    await prisma.dealActivity.deleteMany({ where: { dealId: deal.id } });
    await prisma.dealActivity.create({
      data: { dealId: deal.id, type: 'STATUS_CHANGE', toStatusId: statusId, memo: 'デモデータ投入', occurredAt: toDate(row.商談日) ?? new Date() },
    });
  }

  // ── 進捗 ──
  for (const row of progressRows) {
    const dealId = dealIdByCode.get(row.案件ID);
    if (!dealId) continue;
    const data = {
      loanReview: pick(LOAN_REVIEW, row.ローン審査, 'NOT_STARTED'),
      siteSurvey: pick(SITE_SURVEY, row.現調, 'NOT_STARTED'),
      siteSurveyAt: toDate(row.現調日),
      subsidy: pick(SUBSIDY, row.補助金, 'NOT_REQUIRED'),
      subsidyProgram: row.補助金制度 || null,
      subsidyAppliedAt: toDate(row.補助金申請日),
      subsidyApprovedAt: toDate(row.交付決定日),
      construction: pick(CONSTRUCTION, row.工事手配, 'NOT_STARTED'),
      constructionScheduledAt: toDate(row.工事予定日),
      constructionCompletedAt: toDate(row.工事完了日),
      completionCheck: pick(PROGRESS, row.完工確認, 'NOT_STARTED'),
      paymentDueAt: toDate(row.入金予定日),
      paidAt: toDate(row.入金日),
      paymentStatus: pick(DEAL_PAYMENT, row.入金状況, 'PENDING'),
      contractDocument: pick(PROGRESS, row.契約書, 'NOT_STARTED'),
      importantMatters: pick(PROGRESS, row.重要事項, 'NOT_STARTED'),
      warranty: pick(PROGRESS, row.保証書, 'NOT_STARTED'),
      sitePhotos: pick(PROGRESS, row.施工写真, 'NOT_STARTED'),
      gridConnection: pick(PROGRESS, row.系統連系, 'NOT_STARTED'),
      attention: row.注意事項 || null,
    };
    await prisma.dealProgress.upsert({ where: { dealId }, create: { dealId, ...data }, update: data });
  }

  // ── 報酬。金額は必ず calcCompensation() で計算し直す ──
  for (const row of compensationRows) {
    const dealId = dealIdByCode.get(row.案件ID);
    if (!dealId) continue;
    const deal = await prisma.deal.findUnique({ where: { id: dealId }, select: { salesPriceExclTax: true } });
    if (!deal?.salesPriceExclTax) continue;

    const inputs = {
      equipmentCost: toNumber(row.設備費),
      constructionCost: toNumber(row.工事代),
      extendedWarrantyCost: toNumber(row.延長保証料),
      otherCost: toNumber(row.その他原価),
      deductionAmount: toNumber(row.控除額),
      salesCommissionRate: toNumber(row.営業コミッション率),
      agencyCommissionRate: toNumber(row.代理店コミッション率),
    };
    const result = calcCompensation({ salesPriceExclTax: deal.salesPriceExclTax, ...inputs });

    const data = {
      ...inputs,
      totalCost: result.totalCost,
      grossProfit: result.grossProfit,
      commissionBase: result.commissionBase,
      salesCommission: result.salesCommission,
      agencyCommission: result.agencyCommission,
      companyGrossProfit: result.companyGrossProfit,
      calculatedAt: new Date(),
      paymentDueAt: toDate(row.支払予定日),
      paidAt: toDate(row.支払日),
      paymentStatus: pick(COMPENSATION_PAYMENT, row.支払状況, 'PENDING'),
      notes: row.備考 || null,
    };
    await prisma.dealCompensation.upsert({ where: { dealId }, create: { dealId, ...data }, update: data });
  }

  return {
    customers: customerIdByExternalId.size,
    deals: dealIdByCode.size,
    progress: progressRows.length,
    compensations: compensationRows.length,
  };
}
