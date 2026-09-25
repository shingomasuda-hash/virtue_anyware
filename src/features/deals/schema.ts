import { z } from 'zod';
import { numericField, optionalDate, optionalId, optionalText } from '@/lib/zod-helpers';

/** 任意の数値（空文字は null）。容量など未入力を許す項目に使う。 */
const optionalNumber = (max: number) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.normalize('NFKC').replace(/,/g, '') : ''))
    .refine((v) => v === '' || Number.isFinite(Number(v)), { message: '数値を入力してください。' })
    .transform((v) => (v === '' ? null : Number(v)))
    .refine((n) => n === null || (n >= 0 && n <= max), { message: `0〜${max} の範囲で入力してください。` });

const dealProductType = z.enum(['PV', 'BT', 'EQ', 'IH']);

/**
 * 商材は複数選択。`<input type="checkbox">` は未チェック時に送信されないため、
 * `productTypes` を `PV.BT` のような文字列 1 つにまとめてから送る。
 */
const productTypesField = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.split('.').filter(Boolean) : []))
  .pipe(z.array(dealProductType).min(1, '商材を 1 つ以上選択してください。'));

export const dealFormSchema = z.object({
  code: optionalText(32),
  customerId: z.string().min(1, '顧客を選択してください。'),
  agencyId: optionalId(),
  statusId: z.string().min(1, '案件ステータスを選択してください。'),
  closerStaffId: optionalId(),
  appointerStaffId: optionalId(),
  productTypes: productTypesField,
  pvManufacturerId: optionalId(),
  pvCapacityKw: optionalNumber(1_000),
  batteryManufacturerId: optionalId(),
  batteryModelId: optionalId(),
  batteryCapacityKwh: optionalNumber(1_000),
  equipmentManufacturerId: optionalId(),
  metAt: optionalDate(),
  contractedAt: optionalDate(),
  salesPriceExclTax: optionalNumber(1_000_000_000),
  paymentMethod: z
    .union([z.literal(''), z.enum(['CASH', 'BANK_TRANSFER', 'INSTALLMENT', 'CREDIT_CARD', 'E_MONEY', 'OTHER'])])
    .optional()
    .transform((v) => (v ? v : null)),
  financeCompanyId: optionalId(),
  lostReason: optionalText(255),
  nextActionAt: optionalDate(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  notes: optionalText(2000),
});

export const dealUpdateSchema = dealFormSchema.extend({ id: z.string().min(1) });

export const dealProgressSchema = z.object({
  dealId: z.string().min(1),
  loanReview: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'PRE_APPROVED', 'MAIN_SCREENING', 'MAIN_APPROVED', 'REJECTED', 'NOT_REQUIRED']),
  siteSurvey: z.enum(['NOT_STARTED', 'SCHEDULING', 'SCHEDULED', 'DONE', 'NOT_REQUIRED']),
  siteSurveyAt: optionalDate(),
  subsidy: z.enum(['NOT_REQUIRED', 'CHECKING', 'PLANNED', 'APPLIED', 'APPROVED', 'REJECTED']),
  subsidyProgram: optionalText(120),
  subsidyAppliedAt: optionalDate(),
  subsidyApprovedAt: optionalDate(),
  construction: z.enum(['NOT_STARTED', 'ARRANGING', 'ARRANGED', 'IN_PROGRESS', 'DONE']),
  constructionScheduledAt: optionalDate(),
  constructionCompletedAt: optionalDate(),
  completionCheck: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_REQUIRED']),
  paymentDueAt: optionalDate(),
  paidAt: optionalDate(),
  paymentStatus: z.enum(['PENDING', 'PARTIAL', 'PAID']),
  contractDocument: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_REQUIRED']),
  importantMatters: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_REQUIRED']),
  warranty: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_REQUIRED']),
  sitePhotos: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_REQUIRED']),
  gridConnection: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NOT_REQUIRED']),
  attention: optionalText(500),
});

/**
 * 報酬。**金額は受け取らない**。
 * 原価・控除額・率だけを受け取り、サーバー側で計算した結果を保存する（§34）。
 */
export const dealCompensationSchema = z.object({
  dealId: z.string().min(1),
  equipmentCost: numericField({ min: 0, max: 1_000_000_000, message: '設備費は数値で入力してください。' }),
  constructionCost: numericField({ min: 0, max: 1_000_000_000, message: '工事代は数値で入力してください。' }),
  extendedWarrantyCost: numericField({ min: 0, max: 1_000_000_000, message: '延長保証料は数値で入力してください。' }),
  otherCost: numericField({ min: 0, max: 1_000_000_000, message: 'その他原価は数値で入力してください。' }),
  deductionAmount: numericField({ min: 0, max: 1_000_000_000, message: '控除額は数値で入力してください。' }),
  salesCommissionRate: numericField({ min: 0, max: 1, message: '営業コミッション率は 0〜1（30% なら 0.3）で入力してください。' }),
  agencyCommissionRate: numericField({ min: 0, max: 1, message: '代理店コミッション率は 0〜1（20% なら 0.2）で入力してください。' }),
  paymentDueAt: optionalDate(),
  paidAt: optionalDate(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'ON_HOLD']),
  notes: optionalText(500),
});
