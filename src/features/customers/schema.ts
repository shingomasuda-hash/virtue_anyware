import { z } from 'zod';
import { optionalDate, optionalId, optionalText } from '@/lib/zod-helpers';

export const customerFormSchema = z.object({
  agencyId: optionalId(),
  externalCustomerId: optionalText(64),
  name: z.string().trim().min(1, '氏名は必須です。').max(120),
  nameKana: optionalText(120),
  phone: optionalText(32),
  email: z.union([z.literal(''), z.string().trim().email('メールアドレスの形式が正しくありません。')]).optional().transform((v) => (v ? v : null)),
  postalCode: optionalText(16),
  prefecture: optionalText(32),
  city: optionalText(64),
  address: optionalText(255),
  building: optionalText(255),
  birthDate: optionalDate(),
  assignedUserId: optionalId(),
  notes: optionalText(2000),
});

export type CustomerFormInput = z.input<typeof customerFormSchema>;
export type CustomerFormValues = z.output<typeof customerFormSchema>;

export const customerUpdateSchema = customerFormSchema.extend({
  id: z.string().min(1),
});
