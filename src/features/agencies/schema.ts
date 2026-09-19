import { z } from 'zod';
import { numericField, optionalDate, optionalId, optionalText, requiredDate } from '@/lib/zod-helpers';

export const agencyFormSchema = z.object({
  code: z.string().trim().min(1, '代理店コードは必須です。').max(32),
  name: z.string().trim().min(1, '代理店名は必須です。').max(120),
  corporateName: optionalText(120),
  contactPerson: optionalText(80),
  phone: optionalText(32),
  email: z.union([z.literal(''), z.string().trim().email('メールアドレスの形式が正しくありません。')]).optional().transform((v) => (v ? v : null)),
  postalCode: optionalText(16),
  prefecture: optionalText(32),
  city: optionalText(64),
  address: optionalText(255),
  building: optionalText(255),
  contractStartDate: optionalDate(),
  contractEndDate: optionalDate(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  paymentTerms: optionalText(120),
  bankName: optionalText(64),
  bankBranch: optionalText(64),
  bankAccountType: optionalText(16),
  bankAccountNumber: optionalText(32),
  bankAccountHolder: optionalText(120),
  notes: optionalText(2000),
});

export const agencyUpdateSchema = agencyFormSchema.extend({ id: z.string().min(1) });

export const agencyUnitPriceSchema = z.object({
  agencyId: z.string().min(1),
  productId: optionalId(),
  unitType: z.enum(['PER_WATT', 'PER_CONTRACT', 'PERCENT_OF_AMOUNT', 'FIXED']),
  unitPrice: numericField({ min: 0, max: 1_000_000, message: '単価は数値で入力してください。' }),
  effectiveFrom: requiredDate('適用開始日を入力してください。'),
  effectiveTo: optionalDate(),
  note: optionalText(255),
});
