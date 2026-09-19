import { z } from 'zod';

/** 空文字を null に正規化する任意文字列。フォーム入力の既定形。 */
export const optionalText = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `${max} 文字以内で入力してください。`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

/** `<input type="date">` の値（空文字あり）を Date | null へ変換する。 */
export const optionalDate = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => {
      if (!v) return null;
      const d = new Date(`${v}T00:00:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    })
    .pipe(z.date().nullable());

export const requiredDate = (message = '日付を入力してください。') =>
  z
    .string()
    .trim()
    .min(1, message)
    .transform((v) => new Date(`${v}T00:00:00`))
    .pipe(z.date({ message }));

/** 数値入力。カンマ・全角を許容し、数値でなければエラーにする。 */
export const numericField = (options: { min?: number; max?: number; message?: string } = {}) =>
  z
    .string()
    .trim()
    .transform((v) => v.normalize('NFKC').replace(/,/g, ''))
    .refine((v) => v !== '' && Number.isFinite(Number(v)), {
      message: options.message ?? '数値を入力してください。',
    })
    .transform((v) => Number(v))
    .refine((n) => options.min === undefined || n >= options.min, {
      message: `${options.min} 以上で入力してください。`,
    })
    .refine((n) => options.max === undefined || n <= options.max, {
      message: `${options.max} 以下で入力してください。`,
    });

/** 任意の ID セレクト（未選択は null）。 */
export const optionalId = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null));

/** FormData をプレーンオブジェクトへ変換する（Server Action の入口）。 */
export function formDataToObject(formData: FormData): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') result[key] = value;
  }
  return result;
}
