import { z } from 'zod';
import { numericField, optionalDate, optionalId, optionalText } from '@/lib/zod-helpers';

export const contractFormSchema = z.object({
  customerId: z.string().trim().min(1, '顧客を選択してください。'),
  productId: z.string().trim().min(1, '商材を選択してください。'),
  agencyId: optionalId(),
  contractNumber: optionalText(64),
  supplierId: optionalId(),
  planId: optionalId(),
  contractWatt: numericField({ min: 0, max: 100_000_000, message: '契約ワット数は数値で入力してください。' }),
  // ── 使用量ベースの手数料算定（エバーグリーン MPプラン等）──
  actualUsageKwh: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v.normalize('NFKC').replace(/,/g, '')) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), {
      message: '使用量は 0 以上の数値で入力してください。',
    }),
  usageMonth: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 12), {
      message: '検針月は 1〜12 で入力してください。',
    }),
  hasStatement: z.union([z.literal('on'), z.literal('')]).optional().transform((v) => v === 'on'),
  isMatchingConfirmed: z.union([z.literal('on'), z.literal('')]).optional().transform((v) => v === 'on'),
  statusId: z.string().trim().min(1, '契約ステータスを選択してください。'),
  appliedAt: optionalDate(),
  contractedAt: optionalDate(),
  activatedAt: optionalDate(),
  eventId: optionalId(),
  staffId: optionalId(),
  campaign: optionalText(120),
  notes: optionalText(2000),
});

export const contractUpdateSchema = contractFormSchema.extend({ id: z.string().min(1) });

export const contractCancelSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(1, 'キャンセル理由を入力してください。').max(500),
});

export const contractRepriceSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(1, '再適用の理由を入力してください。').max(200),
});

export type ContractFormInput = z.input<typeof contractFormSchema>;
