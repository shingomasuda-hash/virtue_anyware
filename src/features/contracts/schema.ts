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
