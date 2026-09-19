import { z } from 'zod';
import { optionalId, optionalText } from '@/lib/zod-helpers';

export const mappingSchema = z.object({
  batchId: z.string().min(1),
  /** { csvHeader: systemFieldKey | '' } の JSON 文字列 */
  mappings: z.string().min(2),
  unknownAgency: z.enum(['error', 'warning']).default('error'),
  defaultStatusCode: optionalText(32),
  fixedAgencyId: optionalId(),
  createOnReview: z.union([z.literal('on'), z.literal('')]).optional().transform((v) => v === 'on'),
  templateId: optionalId(),
});

export const batchIdSchema = z.object({ batchId: z.string().min(1) });

export const saveTemplateSchema = z.object({
  batchId: z.string().min(1),
  templateId: optionalId(),
  name: z.string().trim().min(1, 'テンプレート名は必須です。').max(80),
  description: optionalText(255),
});

export const deleteTemplateSchema = z.object({ id: z.string().min(1) });

export function parseMappingsJson(value: string): Record<string, string | null> {
  const parsed: unknown = JSON.parse(value);
  if (typeof parsed !== 'object' || parsed === null) return {};
  const result: Record<string, string | null> = {};
  for (const [key, mapped] of Object.entries(parsed as Record<string, unknown>)) {
    result[key] = typeof mapped === 'string' && mapped !== '' ? mapped : null;
  }
  return result;
}
